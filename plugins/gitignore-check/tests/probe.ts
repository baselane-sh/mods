import type { ProcessRunResult, ToolCallResult } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export const CWD = '/repo'

// Answers for `git -C /repo <args>`, keyed by the args joined with spaces.
// A key that is absent makes git exit 1. Leave out `rev-parse
// --is-inside-work-tree` to stand for a directory outside any repo.
export type GitAnswers = Readonly<Record<string, string>>

export type ProbeOptions = { git?: GitAnswers; output?: string }

export type Probe = {
  answered: (command: string) => Promise<boolean>
  run: (command: string) => Promise<ToolCallResult>
}

const processResult = (stdout: string | undefined): ProcessRunResult => ({
  exitCode: stdout === undefined ? 1 : 0,
  stdout: stdout ?? '',
  stderr: '',
  isStdoutTruncated: false,
  isStderrTruncated: false,
})

// Stands in for the engine beneath the guards. When a guard answers a call
// (ask or deny), the engine's own PreToolUse hooks beneath it are not
// reached; when every guard passes, they are.
export const probe = ($: Engine, on: OnFn, options: ProbeOptions = {}): Probe => {
  let reached = 0
  const prefix = `git -C ${CWD} `
  const output = options.output ?? ''

  on('session.cwd', () => ({ value: CWD }))
  on('process.run', (_$, e) => {
    const command = e.argv.join(' ')
    const key = command.startsWith(prefix) ? command.slice(prefix.length) : command
    return { value: processResult(options.git?.[key]) }
  })
  on('classic.PreToolUse', ($, e, next) => {
    reached += 1
    return next(e)
  })
  on('tool.call', () => ({ result: { stdout: output, stderr: '', interrupted: false }, text: output }))

  const run = (command: string) => $.tool.call({ tool: 'Bash', command })

  return {
    run,
    answered: async command => {
      const before = reached
      await run(command)
      return reached === before
    },
  }
}
