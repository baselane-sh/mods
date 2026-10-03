// The state the Agent Firewall pane draws from. The build copies this file
// into the mod as its contract (plugin.json "types").

// What became of one tool call: it ran, it ran after being put to the
// mode's decider (asked), a rule or the person refused it (blocked), or the
// tool reported an error.
export type FirewallOutcome = 'ran' | 'asked' | 'blocked' | 'error'

export type FirewallRow = {
  id: string
  at: number
  tool: string
  summary: string
  outcome: FirewallOutcome
}

// Session totals. They count every call, not only the rows still kept.
export type FirewallCounts = {
  calls: number
  ran: number
  asked: number
  blocked: number
  errors: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-firewall': { rows: FirewallRow[]; counts: FirewallCounts }
  }
}
