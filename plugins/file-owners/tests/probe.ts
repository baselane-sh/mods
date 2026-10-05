import type { ProcessRunResult } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

import type { CommandRecord } from '../types'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// A command containing this word is denied beneath the plugin; one containing
// FAIL runs and comes back as an error.
export const DENY_WORD = 'DENYME'
export const FAIL_WORD = 'FAILME'

export const CWD = '/repo'

export type Fakes = {
  // The session's working directory (default /repo).
  cwd?: string
  // Answers for `git -C <cwd> <args>`, keyed by the args joined with spaces.
  // A key that is absent makes git exit 1, so leave out `rev-parse
  // --is-inside-work-tree` to stand for a folder outside any repo.
  git?: Readonly<Record<string, string>>
  // Exit codes for a program (a git key or a full argv joined with spaces); the
  // default is 0 when the program has an answer and 1 when it has none.
  exit?: Readonly<Record<string, number>>
  // Programs that run past their timeout: the call rejects and the clock moves by the timeout.
  timeout?: readonly string[]
  // Directory listings by path: names, a trailing "/" marks a folder. A path
  // that is absent is missing.
  dirs?: Readonly<Record<string, readonly string[]>>
  // Git answers that come back cut at the host's 4 MiB cap.
  truncated?: readonly string[]
  // Files that already exist, by path.
  files?: readonly string[]
  // Files fs.read can read, by path: the text. A path that is absent is missing.
  contents?: Readonly<Record<string, string>>
  // Every fs.write rejects.
  writeFails?: boolean
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
  run: (name: string, args?: string) => Promise<string>
  // The record as the engine last wrote it to `$.state`.
  recorded: () => CommandRecord | undefined
  registered: () => readonly { name: string; description: string }[]
  copied: () => readonly string[]
  // Every file the commands wrote, by path.
  written: () => Readonly<Record<string, string>>
  // Every argv the commands ran through process.run, joined with spaces.
  ran: () => readonly string[]
}

// Stands in for the engine beneath the commands. Every figure a receipt
// reads is fixed here; a figure left out is absent, as the host leaves it out.
export const probe = ($: Engine, on: OnFn, fakes: Fakes = {}): CommandProbe => {
  let registered: { name: string; description: string }[] = []
  let copied: string[] = []
  let written: Record<string, string> = {}
  let ran: string[] = []
  const cwd = fakes.cwd ?? CWD

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
  // A program that times out moves the clock by its timeout, as real time would.
  let waited = 0
  on('clock.now', () => ({ value: (fakes.now ?? 0) + waited }))
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
  on('session.cwd', () => ({ value: cwd }))
  on('process.run', (_$, e) => {
    const command = e.argv.join(' ')
    ran = [...ran, command]
    const prefix = `git -C ${cwd} `
    const key = command.startsWith(prefix) ? command.slice(prefix.length) : command
    if (fakes.timeout?.includes(key) === true) {
      // The host rejects after the program's timeout.
      waited += e.init?.timeoutMs ?? 0
      throw new Error('process did not exit')
    }
    const stdout = fakes.git?.[key]
    const result: ProcessRunResult = {
      exitCode: fakes.exit?.[key] ?? (stdout === undefined ? 1 : 0),
      stdout: stdout ?? '',
      stderr: '',
      isStdoutTruncated: fakes.truncated?.includes(key) ?? false,
      isStderrTruncated: false,
    }
    return { value: result }
  })
  on('fs.list', (_$, e) => {
    const names = fakes.dirs?.[e.path]
    if (names === undefined) throw new Error(`ENOENT: ${e.path}`)
    return {
      value: names.map(name => ({
        name: name.replace(/\/$/, ''),
        kind: name.endsWith('/') ? ('dir' as const) : ('file' as const),
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  on('fs.exists', (_$, e) => ({ value: (fakes.files ?? []).includes(e.path) || e.path in written }))
  on('fs.read', (_$, e) => {
    const text = fakes.contents?.[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_$, e) => {
    if (fakes.writeFails === true) throw new Error('disk full')
    written = { ...written, [e.path]: e.text }
    return { value: undefined }
  })
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
      await $.session.start({ cwd, surface: null, isInteractive: true })
    },
    run: async (name, args = '') => (await $.command.run({ command: name, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })).text ?? '',
    // The record as the engine last wrote it to `$.state`.
    // Whatever mod name the engine runs under owns the value, so read it by key.
    recorded: () => [...state].find(([name]) => name.endsWith('.record'))?.[1].value as CommandRecord | undefined,
    registered: () => registered,
    copied: () => copied,
    written: () => written,
    ran: () => ran,
  }
}
