import type { ProcessRunResult, ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { PaneLine } from '../types'

// What a rule may ask of the host while it reads the world. The engine hands
// closures over `$`; `$` itself never comes here.
export type PaneHost = {
  // Runs a command by argv in the session's directory.
  run: (argv: readonly string[]) => Promise<ProcessRunResult>
  cwd: () => Promise<string>
}

// A finished tool call, for a rule that reads tool results.
export type Observed = {
  e: ToolCallEnvelope
  ran: ToolCallResult
  // How long the call took, by the host clock.
  durationMs: number
}

export type PaneSpec = {
  id: string
  title: string
  // The slash command that toggles the pane, without the slash.
  command: string
  description: string
  // What the pane says before it has anything to show.
  empty: string
}

// One live pane. `load` reads the world (on open, after the tool calls
// `refreshAfter` names, and every `everyMs` while open); `observe` reads a
// finished tool call and answers new lines, or undefined to keep the old.
export type PaneRule = {
  id: string
  pane: PaneSpec
  everyMs?: number
  refreshAfter?: (e: ToolCallEnvelope) => boolean
  load?: (host: PaneHost) => Promise<PaneLine[]>
  observe?: (call: Observed) => PaneLine[] | undefined
}
