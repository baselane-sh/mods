// The state a live side pane draws from. The build copies this file into the
// mod as its contract (plugin.json "types"), with the token below replaced by
// the mod's name: only the plugin that owns a `$.state` value may write it.

// One run of text on a line. The text says everything; color only adds.
export type PaneCell = {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
}

// One line of a pane, its cells drawn left to right and cut to the pane's
// width. A line with `isRule` is a horizontal rule across the pane.
export type PaneLine = {
  key: string
  cells: PaneCell[]
  isRule?: boolean
}

// What a pane shows: its lines, already redacted, and when they were read.
export type PaneView = {
  at: number
  lines: PaneLine[]
}

// One turn of the person's, as the engine measured it from the session cost
// (kept only for a mod whose rule asks for turns).
export type TurnCost = {
  turnId: string
  // 1 for the first turn the mod saw this session.
  n: number
  // The session cost in US dollars as the turn began; null where the host
  // said none.
  startUsd: number | null
  ended: boolean
  // What the turn cost, once it ended and both costs were known.
  usd?: number
  // When the turn began and ended, by the host clock (absent in a ledger
  // written before they were kept).
  startedAt?: number
  endedAt?: number
  // Tool calls made while the turn ran, subagents' included.
  tools?: number
}

// One file Claude touched this session, with how often each action ran on it
// (kept only for a mod whose rule asks for files).
export type FileTouch = {
  path: string
  reads: number
  edits: number
  writes: number
  // When it was last touched, by the host clock.
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'context-pane': {
      // By pane id: one mod may draw several panes.
      views: Record<string, PaneView>
      // Oldest first.
      turns: TurnCost[]
      // Oldest touch first.
      files: FileTouch[]
    }
  }
}
