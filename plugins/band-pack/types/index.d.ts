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

declare module 'claude-code' {
  interface PluginState {
    'band-pack': {
      reading: Reading | null
      // The session cost when the running turn began: the base of its delta.
      turnStartUsd: number | null
    }
  }
}
