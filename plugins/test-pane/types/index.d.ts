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

declare module 'claude-code' {
  interface PluginState {
    'test-pane': {
      // By pane id: one mod may draw several panes.
      views: Record<string, PaneView>
    }
  }
}
