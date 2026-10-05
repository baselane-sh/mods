// What the command engine keeps in `$.state`, so a hot reload does not lose
// the session so far. Everything here is already redacted.
export type CommandRecord = {
  /** Every tool call seen, denied and errored ones included. */
  calls: number
  /** Calls per tool name. */
  tools: Record<string, number>
  /** Unique paths a Write, Edit, MultiEdit or NotebookEdit call touched. */
  files: string[]
  /** Every Bash command that ran (not denied), uncapped. */
  commandsRun: number
  /** The latest of those commands, newest last, capped. */
  commands: string[]
  /** Calls a hook denied. */
  blocked: number
  /** Calls that ran and came back as an error. */
  errored: number
}

declare module 'claude-code' {
  interface PluginState {
    stashes: { record: CommandRecord }
  }
}
