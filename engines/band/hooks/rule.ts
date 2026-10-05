import type { PluginOptions, ProcessRunResult } from 'claude-code'

import type { Fetched, GitState, Outcome, Pomodoro, Reading, Tally } from '../types'

// One piece of the band. `key` names its Text so a test or a host can find it.
export type Segment = {
  key: string
  text: string
  color?: string
}

// What a rule may read to name its segment.
export type DrawContext = {
  reading: Reading
  options: PluginOptions
  // The local date, YYYY-MM-DD.
  date: string
  // The outcomes of the last tool calls, oldest first.
  outcomes: readonly Outcome[]
  // The running pomodoro, or null.
  pomodoro: Pomodoro | null
  // The clock at this drawing, in milliseconds.
  now: number
  // Tool calls this session.
  tally: Tally
  // The repository's branch and changed files, or null.
  git: GitState | null
  // What the fetching rules last read, by rule id.
  fetched: Readonly<Record<string, Fetched | null>>
  // When the running turn began, or null between turns.
  turnStartedAt: number | null
}

// The prompt cache tokens of one turn, summed over its requests.
export type TurnTokens = {
  // Uncached input, what the cache served, and what the turn wrote to it.
  input: number
  cacheRead: number
  cacheWrite: number
}

// What a rule may touch at a turn end.
export type TurnEnd = {
  reading: Reading
  // The reading the last turn end left, or empty before the first.
  previous: Reading
  // What the turn's requests spent on the prompt cache, when it had any.
  usage?: TurnTokens
  // What this turn cost, when known.
  turnUsd: number | undefined
  date: string
  // The mod's own store. The engine hands closures over `$.store`.
  store: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }
}

// One rule of the band: the segment it draws, and optionally what it keeps at
// a turn end (returned as the reading's new fields).
export type BandRule = {
  id: string
  segment: (draw: DrawContext) => Segment | undefined
  atTurnEnd?: (turn: TurnEnd) => Promise<Partial<Reading>>
  // Set by a rule that draws from how the last tool calls ended. The engine
  // then records each call's outcome into the `outcomes` atom.
  tracksOutcomes?: true
  // Set by a rule that draws from the tool calls of the whole session. The
  // engine then counts each call, by tool, into the `tally` atom.
  tracksTools?: true
  // Set by a rule that draws from the repository. The engine then reads the
  // branch and the changed files after a Bash call or a file edit.
  tracksGit?: true
  // Set by a rule that draws from the running turn. The engine then keeps when
  // the turn began, and redraws each second while it runs.
  tracksTurn?: true
  // A rule that draws from a command's output (see Fetcher).
  fetch?: Fetcher
  // For a rule with a timer, started and stopped by a slash command.
  ticker?: Ticker
  // Set by a rule whose segment moves with the clock alone. While it answers
  // true for the last turn's reading, the engine redraws the band on each
  // minute, and only then.
  everyMinute?: (reading: Reading) => boolean
}

// How a rule gets a figure from a command, never in a tool call's way: the
// engine runs it beside the call, at most one run at a time per rule.
export type Fetcher = {
  // At most one run per this many milliseconds from the turn end, the session
  // start and the minute tick. Absent: only after a file-touching tool call.
  everyMs?: number
  // Also run after a tool call that can change files (a Bash call, an edit).
  onEdit?: true
  // A run is killed after this long and its figure is dropped.
  timeoutMs: number
  // `run` takes an argv (no shell). Answer what to draw, null to hide the
  // segment, or undefined to leave the last figure as it is and not count the
  // run (for a rule that has nothing to ask yet). A throw hides the segment.
  // `now` is the clock at the run's start, in milliseconds.
  read: (
    run: (argv: readonly string[]) => Promise<ProcessRunResult>,
    git: GitState | null,
    now: number,
  ) => Promise<Fetched | null | undefined>
}

// A timer the person starts and stops with `/<command.name>`. Pure, so a rule
// never holds `$`: the engine registers the command, keeps the interval and
// writes the timer into the `pomodoro` atom.
export type Ticker = {
  command: { name: string; description: string }
  // One tick every `everyMs`, and so at most one redraw per tick.
  everyMs: number
  // The command ran at `now`: the timer it leaves (null stops it), and what to print.
  toggle: (current: Pomodoro | null, now: number) => { next: Pomodoro | null; text: string }
  // One tick at `now`: the timer after it, and a toast when something changed.
  tick: (current: Pomodoro, now: number) => { next: Pomodoro; toast?: string }
}
