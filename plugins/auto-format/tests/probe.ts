import { mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

export type Fetched = { url: string; method?: string; headers?: Record<string, string>; body?: string }

// What a fake formatter did: its exit code, stderr, and what it wrote.
export type Formatted = { exitCode: number; stderr?: string }

export type ProbeOptions = {
  // Files by absolute path. A directory exists when a file lies beneath it.
  files?: Readonly<Record<string, string>>
  // Programs `which` finds: name to absolute path.
  onPath?: Readonly<Record<string, string>>
  // Runs when a program other than `which` is started; may edit `files`.
  format?: (argv: readonly string[], files: Map<string, string>) => Formatted
  home?: string
  cwd?: string
  now?: number
  // Make the ntfy server answer this status.
  ntfyStatus?: number
}

export type Probe = {
  edit: (file_path: string, tookMs?: number) => ReturnType<Engine['tool']['call']>
  bash: (command: string, tookMs?: number) => ReturnType<Engine['tool']['call']>
  needsInput: (cwd?: string) => Promise<unknown>
  sessionEnd: (reason?: 'other' | 'clear' | 'logout', cwd?: string) => Promise<unknown>
  files: () => ReadonlyMap<string, string>
  fetched: () => readonly Fetched[]
  started: () => readonly (readonly string[])[]
}

const parent = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/'

// Stands in for the engine beneath the lifecycle rules: a file system in
// memory, `which`, a recording ntfy server and a clock that only a slow tool
// moves.
export const probe = ($: Engine, on: OnFn, options: ProbeOptions = {}): Probe => {
  const files = new Map(Object.entries(options.files ?? {}))
  let fetched: Fetched[] = []
  let started: (readonly string[])[] = []
  let tookMs = 0
  const clock = mock.clock(on, { now: options.now ?? 1_700_000_000_000 })
  const dirs = (): Set<string> => {
    const found = new Set<string>(['/'])
    for (const path of files.keys()) {
      for (let dir = parent(path); !found.has(dir); dir = parent(dir)) found.add(dir)
    }
    return found
  }

  on('session.cwd', () => ({ value: options.cwd ?? '/repo' }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? options.home : undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('fs.exists', (_$, e) => ({ value: files.has(e.path) || dirs().has(e.path) }))
  on('fs.read', (_$, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('fs.write', (_$, e) => {
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.list', (_$, e) => {
    const names = new Map<string, 'file' | 'dir'>()
    for (const path of files.keys()) {
      const prefix = e.path === '/' ? '/' : `${e.path}/`
      if (!path.startsWith(prefix)) continue
      const [name, ...rest] = path.slice(prefix.length).split('/')
      if (name !== undefined) names.set(name, rest.length > 0 ? 'dir' : 'file')
    }
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('process.run', (_$, e) => {
    started = [...started, e.argv]
    if (e.argv[0] === 'which') {
      const found = options.onPath?.[e.argv[1] ?? '']
      return { value: { exitCode: found === undefined ? 1 : 0, stdout: found ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const done = options.format?.(e.argv, files) ?? { exitCode: 0 }
    return { value: { exitCode: done.exitCode, stdout: '', stderr: done.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('http.fetch', (_$, e) => {
    fetched = [...fetched, { url: e.url, method: e.init?.method, headers: e.init?.headers, body: e.init?.body }]
    const status = options.ntfyStatus ?? 200
    return { value: { status, ok: status >= 200 && status < 300, headers: {}, text: '' } }
  })
  on('tool.call', async () => {
    await clock.advance(tookMs)
    return { result: {} }
  })
  on('classic.Notification', () => ({}))
  on('classic.SessionEnd', () => ({}))

  return {
    edit: (file_path, ms = 0) => {
      tookMs = ms
      return $.tool.call({ tool: 'Write', file_path, content: 'x' })
    },
    bash: (command, ms = 0) => {
      tookMs = ms
      return $.tool.call({ tool: 'Bash', command })
    },
    needsInput: (cwd = '/work/myproj') =>
      $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt', cwd }),
    sessionEnd: (reason = 'other', cwd = '/work/myproj') => $.classic.SessionEnd({ reason, cwd }),
    files: () => files,
    fetched: () => fetched,
    started: () => started,
  }
}
