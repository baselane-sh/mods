import type { ProcessRunResult, SessionUsage, ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { PaneLine, TurnCost } from '../types'

// What a rule may ask of the host while it reads the world. The engine hands
// closures over `$`; `$` itself never comes here.
export type PaneHost = {
  // Runs a command by argv in the session's directory.
  run: (argv: readonly string[]) => Promise<ProcessRunResult>
  cwd: () => Promise<string>
  usage: () => Promise<SessionUsage>
  // The turns measured so far, oldest first (empty unless the rule asks for turns).
  turns: () => Promise<readonly TurnCost[]>
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
// `turns` has the engine measure each turn's cost and load after each turn.
export type PaneRule = {
  id: string
  pane: PaneSpec
  everyMs?: number
  turns?: boolean
  refreshAfter?: (e: ToolCallEnvelope) => boolean
  load?: (host: PaneHost) => Promise<PaneLine[]>
  observe?: (call: Observed) => PaneLine[] | undefined
}
