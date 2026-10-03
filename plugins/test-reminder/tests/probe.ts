import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export type NudgeProbe = {
  bash: (command: string) => Promise<unknown>
  write: (file_path: string) => Promise<unknown>
  stop: () => Promise<readonly string[]>
}

// Stands in for the engine beneath the nudges: tools answer at once, the
// context window reads `percent`, and each stop answers the toasts it raised.
export const probe = ($: Engine, on: OnFn, percent = 10): NudgeProbe => {
  let toasts: string[] = []

  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: percent * 2000, window: 200_000, percent }, rateLimits: [] } }))
  on('ui.toast', (_$, e) => {
    toasts = [...toasts, e.text]
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('classic.Stop', () => ({}))
  on('tool.call', () => ({ result: {} }))

  return {
    bash: command => $.tool.call({ tool: 'Bash', command }),
    write: file_path => $.tool.call({ tool: 'Write', file_path, content: 'x' }),
    stop: async () => {
      toasts = []
      await $.classic.Stop({ stop_hook_active: false })
      return toasts
    },
  }
}
