import type { PluginOptions } from 'claude-code'

import type { GitState, Outcome, Pomodoro, Reading, Tally } from '../types'

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
}

// What a rule may touch at a turn end.
export type TurnEnd = {
  reading: Reading
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
  // For a rule with a timer, started and stopped by a slash command.
  ticker?: Ticker
  // Set by a rule whose segment moves with the clock alone. While it answers
  // true for the last turn's reading, the engine redraws the band on each
  // minute, and only then.
  everyMinute?: (reading: Reading) => boolean
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
