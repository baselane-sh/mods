import type { Day, Life } from '../types'

export type Days = Readonly<Record<string, Day>>

// The mod's own store, as closures over `$.store` (a rule never holds `$`).
export type Store = {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

// What a command reads: the rollup as it stands.
export type View = {
  /** The local date, YYYY-MM-DD. */
  date: string
  /** The clock, in ms. */
  now: number
  days: Days
  life: Life
  store: Store
}

// What a rule sees right after the engine wrote a session start or a turn end.
export type After = View & {
  event: 'session' | 'turn'
  /** When the session began, if the host said. A resumed session keeps its first start. */
  startedAt?: number
  /**
   * When this run of the session began: the later of `startedAt` and the
   * first session start this process saw. A resumed session's time away is
   * not in it. Absent when the host gave no start.
   */
  runStartedAt?: number
  /** Tool calls counted this session so far. */
  sessionCalls?: number
  /** On a turn: when its prompt was sent (the turn's end less its length). */
  promptAt?: number
}

// What a rule sees as the session ends, after the last flush. A toast here
// would go unseen, so `ended` answers nothing.
export type Ended = View & {
  /** When the session began, if the host said. */
  startedAt?: number
  /** The session's cost in US dollars, if the host said. */
  usd?: number
  sessionCalls?: number
}

// What a rule sees when a tool call has finished (a denied call included).
export type Call = {
  /** The local date, YYYY-MM-DD. */
  date: string
  /** The clock, in ms. */
  now: number
  tool: string
  /** The command of a Bash call. */
  command?: string
  /** True when the call ran and did not fail: not denied, not an error. */
  ok: boolean
  store: Store
}

// Text to print, or `{ text, copy: false }` for a message that is not a result.
export type Composed = string | { text: string; copy: false }

export type StatsRule = {
  id: string
  command?: {
    name: string
    description: string
    /** Whether the answer also goes to the clipboard. */
    copy: boolean
    compose: (view: View, args: string) => Promise<Composed> | Composed
  }
  /** Has the engine keep files edited per type under the store key `langs`. */
  langs?: boolean
  /** Toast lines to show after each tool call, in order. Only a mod with such a rule runs it. */
  call?: (ctx: Call) => Promise<readonly string[]>
  /** Toast lines to show, in order. */
  after?: (ctx: After) => Promise<readonly string[]>
  ended?: (ctx: Ended) => Promise<void>
}
