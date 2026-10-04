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

declare module 'claude-code' {
  interface PluginState {
    'band-pack': {
      reading: Reading | null
      // The session cost when the running turn began: the base of its delta.
      turnStartUsd: number | null
      // The outcomes of the last tool calls, oldest first.
      outcomes: readonly Outcome[]
      // The running pomodoro, or null when none runs.
      pomodoro: Pomodoro | null
    }
  }
}
