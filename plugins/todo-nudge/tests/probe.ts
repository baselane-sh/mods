import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export type NudgeProbe = {
  bash: (command: string) => Promise<unknown>
  // `originalFile` is what the file held before, as the host reports it for
  // a Write over an existing file; leave it out for a new file.
  write: (file_path: string, content?: string, originalFile?: string) => Promise<unknown>
  edit: (file_path: string, new_string?: string, old_string?: string) => Promise<unknown>
  // Moves the host clock (`$.clock.now`); the session started at 0.
  setNow: (ms: number) => void
  // The session cwd (`$.session.cwd`); it starts as DEFAULT_CWD.
  setCwd: (path: string) => void
  stop: () => Promise<readonly string[]>
  // The text `.env.example` holds, or undefined for a project without one.
  setEnvExample: (text: string | undefined) => void
  // The file name of every path the mod asked `fs.read` for.
  reads: () => readonly string[]
  // Every request that reached `model.complete`.
  asked: () => readonly ModelCompleteRequest[]
  // Every line the mod wrote to the log: a nudge that threw leaves one.
  logs: () => readonly string[]
}

// A Bash command containing this word is denied beneath the mod; one
// containing FAIL runs and comes back as an error.
export const DENY_WORD = 'DENYME'
export const FAIL_WORD = 'FAILME'

export const DEFAULT_CWD = '/repo'

export const USAGE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// The host resolves a relative path against the cwd, so compare file names.
const name = (path: string): string => path.split('/').pop() ?? ''

// What the fake model answers: a reply, or one of the ways it is left without.
export type ModelFake = string | 'empty-reply' | 'aborted' | 'api-error'

const answer = (fake: ModelFake): ModelCompleteResult => {
  if (fake === 'empty-reply' || fake === 'aborted') return { isAnswered: false, reason: fake, usage: USAGE }
  if (fake === 'api-error') {
    return { isAnswered: false, reason: 'api-error', status: 529, error: 'unknown', usage: USAGE }
  }
  return { isAnswered: true, text: fake, usage: USAGE }
}

// Stands in for the engine beneath the nudges: tools answer at once, the
// context window reads `percent`, and each stop answers the toasts it raised.
export const probe = ($: Engine, on: OnFn, percent = 10, model: ModelFake = 'And Claude is on the board!'): NudgeProbe => {
  let toasts: string[] = []
  let asked: ModelCompleteRequest[] = []
  let logs: string[] = []
  let now = 0
  let envExample: string | undefined
  let reads: string[] = []
  let cwd = DEFAULT_CWD
  let originals: Readonly<Record<string, string>> = {}

  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: percent * 2000, window: 200_000, percent }, rateLimits: [] } }))
  on('clock.now', () => ({ value: now }))
  on('session.cwd', () => ({ value: cwd }))
  on('ui.toast', (_$, e) => {
    toasts = [...toasts, e.text]
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    logs = [...logs, e.text]
    return { value: undefined }
  })
  on('fs.exists', (_$, e) => ({ value: name(e.path) === '.env.example' && envExample !== undefined }))
  on('fs.read', (_$, e) => {
    reads = [...reads, name(e.path)]
    return { value: envExample ?? '' }
  })
  on('classic.Stop', () => ({}))
  on('tool.call', (_$, e) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (command.includes(DENY_WORD)) return { deny: 'blocked by test' }
    if (command.includes(FAIL_WORD)) return { result: {}, isError: true }
    const original = e.tool === 'Write' ? originals[e.file_path] : undefined
    return { result: original === undefined ? {} : { originalFile: original } }
  })
  on('model.complete', (_$, e) => {
    asked = [...asked, e]
    return { value: answer(model) }
  })

  return {
    bash: command => $.tool.call({ tool: 'Bash', command }),
    write: (file_path, content = 'x', originalFile) => {
      if (originalFile !== undefined) originals = { ...originals, [file_path]: originalFile }
      return $.tool.call({ tool: 'Write', file_path, content })
    },
    edit: (file_path, new_string = 'b', old_string = 'a') => $.tool.call({ tool: 'Edit', file_path, old_string, new_string }),
    setNow: ms => {
      now = ms
    },
    setCwd: path => {
      cwd = path
    },
    setEnvExample: text => {
      envExample = text
    },
    reads: () => reads,
    asked: () => asked,
    logs: () => logs,
    stop: async () => {
      toasts = []
      await $.classic.Stop({ stop_hook_active: false })
      return toasts
    },
  }
}
