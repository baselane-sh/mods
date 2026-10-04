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
  /** When the session began, if the host said. */
  startedAt?: number
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
  /** Toast lines to show, in order. */
  after?: (ctx: After) => Promise<readonly string[]>
}
