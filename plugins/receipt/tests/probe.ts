import type { TestBody } from 'claude-code/testing'

import type { CommandRecord } from '../types'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// A command containing this word is denied beneath the plugin; one containing
// FAIL runs and comes back as an error.
export const DENY_WORD = 'DENYME'
export const FAIL_WORD = 'FAILME'

export type Fakes = {
  turns?: number
  startedAt?: number
  now?: number
  percent?: number
  usd?: number
  // How the clipboard answers: taken, refused, or the call itself throws.
  copy?: 'ok' | 'no-clipboard' | 'throw'
}

export type CommandProbe = {
  bash: (command: string) => Promise<unknown>
  write: (file_path: string) => Promise<unknown>
  edit: (file_path: string) => Promise<unknown>
  read: (file_path: string) => Promise<unknown>
  // Raises session.start, the way the session does.
  start: () => Promise<void>
  // Runs `/<name>` and answers its output text.
  run: (name: string) => Promise<string>
  // The record as the engine last wrote it to `$.state`.
  recorded: () => CommandRecord | undefined
  registered: () => readonly { name: string; description: string }[]
  copied: () => readonly string[]
}

// Stands in for the engine beneath the commands. Every figure a receipt
// reads is fixed here; a figure left out is absent, as the host leaves it out.
export const probe = ($: Engine, on: OnFn, fakes: Fakes = {}): CommandProbe => {
  let registered: { name: string; description: string }[] = []
  let copied: string[] = []

  const state = new Map<string, { value: unknown; version: number }>()
  on('state.get', (_$, e) => ({ value: { value: state.get(`${e.plugin}.${e.key}`)?.value, version: state.get(`${e.plugin}.${e.key}`)?.version ?? 0 } }))
  on('state.set', (_$, e) => {
    const name = `${e.plugin}.${e.key}`
    const version = state.get(name)?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== version) return { value: { isSet: false as const, version } }
    state.set(name, { value: e.value, version: version + 1 })
    return { value: { isSet: true as const, version: version + 1 } }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('session.turns', () => ({ value: fakes.turns ?? 0 }))
  on('clock.now', () => ({ value: fakes.now ?? 0 }))
  on('session.usage', () => ({
    value: {
      startedAt: fakes.startedAt ?? 0,
      context: { window: 200_000, ...(fakes.percent === undefined ? {} : { tokens: fakes.percent * 2000, percent: fakes.percent }) },
      rateLimits: [],
      ...(fakes.usd === undefined ? {} : { cost: { usd: fakes.usd } }),
    },
  }))
  on('command.register', (_$, e) => {
    registered = [...registered, { name: e.name, description: e.description }]
    return { value: { command: e.name } }
  })
  on('ui.copy', (_$, e) => {
    if (fakes.copy === 'throw') throw new Error('clipboard exploded')
    if (fakes.copy === 'no-clipboard') return { value: { isCopied: false as const, reason: 'no-clipboard' as const } }
    copied = [...copied, e.text]
    return { value: { isCopied: true as const } }
  })
  on('ui.log', () => ({ value: undefined }))
  on('tool.call', (_$, e) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (command.includes(DENY_WORD)) return { deny: 'blocked by test' }
    if (command.includes(FAIL_WORD)) return { result: {}, isError: true }
    return { result: {} }
  })

  return {
    bash: command => $.tool.call({ tool: 'Bash', command }),
    write: file_path => $.tool.call({ tool: 'Write', file_path, content: 'x' }),
    edit: file_path => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }),
    read: file_path => $.tool.call({ tool: 'Read', file_path }),
    start: async () => {
      await $.session.start({ cwd: '/repo', surface: null, isInteractive: true })
    },
    run: async name => (await $.command.run({ command: name, args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })).text ?? '',
    // The record as the engine last wrote it to `$.state`.
    recorded: () => state.get('receipt.record')?.value as CommandRecord | undefined,
    registered: () => registered,
    copied: () => copied,
  }
}
