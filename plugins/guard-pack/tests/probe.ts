import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export type Probe = { answered: (command: string) => Promise<boolean> }

// Stands in for the engine beneath the guards. When a guard answers a call
// (ask or deny), the engine's own PreToolUse hooks beneath it are not
// reached; when every guard passes, they are.
export const probe = ($: Engine, on: OnFn): Probe => {
  let reached = 0

  on('classic.PreToolUse', ($, e, next) => {
    reached += 1
    return next(e)
  })
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))

  return {
    answered: async command => {
      const before = reached
      await $.tool.call({ tool: 'Bash', command })
      return reached === before
    },
  }
}
