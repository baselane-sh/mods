import { mock } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { addDays, localDate } from '../hooks/date'
import type { Day } from '../types'

type Engine = Parameters<TestBody>[0]
type OnFn = Parameters<TestBody>[1]

// A command containing this word is denied beneath the plugin; one containing
// FAIL runs and comes back as an error (a non-zero exit).
export const DENY_WORD = 'DENYME'
export const FAIL_WORD = 'FAILME'

export const HOUR = 3_600_000

// A local time, so a test means the same day and hour in any zone.
export const at = (y: number, month: number, d: number, hour = 12, minute = 0): number => new Date(y, month - 1, d, hour, minute).getTime()

// 2026-10-04 (a Sunday) at noon.
export const NOON = at(2026, 10, 4)
export const TODAY = '2026-10-04'

export const day = (patch: Partial<Day> = {}): Day => ({
  sessions: 0,
  turns: 0,
  calls: 0,
  files: 0,
  passed: 0,
  failed: 0,
  blocked: 0,
  tools: {},
  ...patch,
})

// Days that each had one turn, as the store keeps them.
export const activeDays = (dates: readonly string[]): Record<string, Day> =>
  Object.fromEntries(dates.map(date => [date, day({ sessions: 1, turns: 1 })]))

// The dates `n` days back from TODAY, starting at `from` days back.
export const back = (from: number, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(TODAY, -(from + i)))

// Whatever the store holds, junk included.
export type Seed = Record<string, unknown>

export type Opts = {
  now?: number
  // The session cost as it stands; a turn moves it.
  usd?: number
  startedAt?: number
  store?: Seed
  // Every store.set rejects.
  setFails?: boolean
}

export type StatsProbe = {
  bash: (command: string) => Promise<unknown>
  write: (file_path: string) => Promise<unknown>
  edit: (file_path: string) => Promise<unknown>
  read: (file_path: string) => Promise<unknown>
  start: () => Promise<void>
  // Ends the session; `clear` is how a /clear looks (default `other`).
  end: (reason?: 'clear' | 'other') => Promise<void>
  // A whole turn: turn.start, the cost moves to `usd` when given, turn.complete.
  // `durationMs` is the turn's length as turn.complete reports it (default 1).
  turn: (usd?: number, durationMs?: number) => Promise<void>
  // Only a turn.complete, under the given id (a repeat of an id is the same turn).
  complete: (turnId: string, extra?: { agentId?: string; durationMs?: number }) => Promise<void>
  run: (name: string, args?: string) => Promise<string>
  advance: (ms: number) => Promise<void>
  toasts: () => readonly string[]
  copied: () => readonly string[]
  registered: () => readonly string[]
  logs: () => readonly string[]
  // The store as it stands, by key.
  stored: () => Readonly<Record<string, unknown>>
  days: () => Record<string, Day>
  setUsd: (usd: number | undefined) => void
  // What the session reports as its start from now on (a /clear moves it).
  setStartedAt: (at: number) => void
}

export const probe = ($: Engine, on: OnFn, opts: Opts = {}): StatsProbe => {
  const clock = mock.clock(on, { now: opts.now ?? NOON })
  let startedAt = opts.startedAt ?? opts.now ?? NOON
  let usd = opts.usd
  let turns = 0
  let toasts: string[] = []
  let copied: string[] = []
  let registered: string[] = []
  let logs: string[] = []

  // The kit's mock.store would do, but these tests read the writes back.
  let kept: Record<string, unknown> = { ...(opts.store ?? {}) }
  on('store.get', (_$, e) => ({ value: kept[e.key] }))
  on('store.set', (_$, e) => {
    if (opts.setFails === true) return { deny: 'disk full' }
    kept = { ...kept, [e.key]: JSON.parse(JSON.stringify(e.value)) }
    return { value: undefined }
  })
  on('store.delete', (_$, e) => {
    const { [e.key]: _gone, ...rest } = kept
    kept = rest
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(kept) }))

  on('session.usage', () => ({
    value: {
      startedAt,
      context: { window: 200_000 },
      rateLimits: [],
      ...(usd === undefined ? {} : { cost: { usd } }),
    },
  }))
  on('ui.toast', (_$, e) => {
    toasts = [...toasts, e.text]
    return { value: undefined }
  })
  on('ui.copy', (_$, e) => {
    copied = [...copied, e.text]
    return { value: { isCopied: true as const } }
  })
  on('ui.log', (_$, e) => {
    logs = [...logs, e.text]
    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    registered = [...registered, e.name]
    return { value: { command: e.name } }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', (_$, e) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (command.includes(DENY_WORD)) return { deny: 'blocked by test' }
    if (command.includes(FAIL_WORD)) return { result: {}, isError: true }
    return { result: {} }
  })

  const complete = async (turnId: string, extra: { agentId?: string; durationMs?: number } = {}) => {
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId, reason: 'answer', ...extra })
  }

  return {
    bash: command => $.tool.call({ tool: 'Bash', command }),
    write: file_path => $.tool.call({ tool: 'Write', file_path, content: 'x' }),
    edit: file_path => $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' }),
    read: file_path => $.tool.call({ tool: 'Read', file_path }),
    start: async () => {
      await $.session.start({ cwd: '/repo', surface: null, isInteractive: true })
    },
    end: async (reason = 'other') => {
      await $.session.end({ reason, sessionId: 's', resume: { id: 's' } })
    },
    turn: async (after, durationMs) => {
      turns += 1
      await $.turn.start({ text: 'go', turnId: `t${turns}` })
      if (after !== undefined) usd = after
      await complete(`t${turns}`, durationMs === undefined ? {} : { durationMs })
    },
    complete,
    run: async (name, args = '') =>
      (await $.command.run({ command: name, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })).text ?? '',
    advance: ms => clock.advance(ms),
    toasts: () => toasts,
    copied: () => copied,
    registered: () => registered,
    logs: () => logs,
    stored: () => kept,
    days: () => (kept['days'] ?? {}) as Record<string, Day>,
    setUsd: value => {
      usd = value
    },
    setStartedAt: at => {
      startedAt = at
    },
  }
}

export { localDate }
