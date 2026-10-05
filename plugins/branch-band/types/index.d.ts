// The state the band draws from. The build copies this file into the mod as
// its contract (plugin.json "types"), with the token below replaced by the
// mod's name: only the plugin that owns a `$.state` value may write it.

// What the last turn end read. A field is absent when its figure was.
export type Reading = {
  // Session cost so far, in US dollars.
  usd?: number
  // What the last turn cost, when known.
  turnUsd?: number
  // Context window used, 0 to 100.
  percent?: number
  // Today's total across sessions, and the local date (YYYY-MM-DD) it is for.
  dailyUsd?: number
  dailyDate?: string
  // When the session began (epoch milliseconds, the clock's own).
  startedAt?: number
  // The main loop's model, as /model shows it.
  model?: string
  // Prompt cache tokens of the main loop since the session began: what the
  // cache served, and every input token the requests were answered over.
  cacheRead?: number
  cacheTotal?: number
  // The daily streak in days, and the local date (YYYY-MM-DD) of its last day.
  streak?: number
  streakDate?: string
}

// How one tool call ended: it ran, it errored, or a hook denied it.
export type Outcome = 'ok' | 'error' | 'block'

// The running pomodoro. `now` is the clock at the last tick: the drawing
// counts down to `endsAt` from it, so a tick is what redraws the band.
export type Pomodoro = {
  phase: 'focus' | 'break'
  endsAt: number
  now: number
}

// Tool calls this session, by tool (an MCP tool by its last name segment),
// with how many failed (an error or a deny) and which tool failed last.
export type Tally = {
  calls: Readonly<Record<string, number>>
  failures: number
  lastFailed?: string
}

// The repository the session works in: its branch and how many files differ
// from HEAD (modified, staged, deleted or untracked).
export type GitState = {
  branch: string
  changed: number
  // Commits ahead of and behind the upstream. Both are absent when the branch
  // has no upstream (or the upstream is gone).
  ahead?: number
  behind?: number
}

// What a fetching rule keeps: the text it draws and an optional color. `tag`
// names what the text is for (the branch of a CI run), so a rule can drop a
// figure that is about something else by the time it draws.
export type Fetched = {
  text: string
  color?: string
  tag?: string
}

declare module 'claude-code' {
  interface PluginState {
    'branch-band': {
      reading: Reading | null
      // The session cost when the running turn began: the base of its delta.
      turnStartUsd: number | null
      // The outcomes of the last tool calls, oldest first.
      outcomes: readonly Outcome[]
      // The running pomodoro, or null when none runs.
      pomodoro: Pomodoro | null
      tally: Tally
      // Null when the session is not in a repository, or before the first read.
      git: GitState | null
      // Bumped on each minute while a rule wants it: the band reads it, so the
      // write redraws a figure that moves with the clock alone.
      minute: number
      // What the fetching rules last read, by rule id. Null: nothing to show.
      fetched: Readonly<Record<string, Fetched | null>>
      // When the running turn began (the clock's own), or null between turns.
      turnStartedAt: number | null
    }
  }
}
