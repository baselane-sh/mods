// What the stats engine keeps. The build copies this file into each mod as its
// contract (plugin.json "types"), with the token below replaced by the mod's
// name: only the plugin that owns a `$.state` value may write it.

// One local day in the store (`days`, keyed YYYY-MM-DD). Counts only: no paths,
// no commands, nothing to redact.
export type Day = {
  sessions: number
  turns: number
  calls: number
  /** Files a Write, Edit, MultiEdit or NotebookEdit touched, unique per session. */
  files: number
  passed: number
  failed: number
  /** Calls a hook denied. */
  blocked: number
  /** Session cost spent that day, in US dollars. Absent when the host never said. */
  usd?: number
  /** Calls per tool name. */
  tools: Record<string, number>
}

// Lifetime totals (store key `life`), kept apart from the days because the
// days are pruned after 400.
export type Life = { calls: number; blocked: number; passed: number }

// What happened since the last flush to the store.
export type Pending = {
  calls: number
  blocked: number
  passed: number
  failed: number
  tools: Record<string, number>
  files: string[]
}

// What the engine remembers about this session (`$.state`, so a hot reload keeps it).
export type SessionMemo = {
  counted: boolean
  lastTurn: string | null
  turnStartUsd: number | null
  lastUsd: number | null
  /** Files already counted this session. */
  seen: string[]
  /** Tool calls flushed this session. Absent in a memo from before it was kept. */
  calls?: number
  /** When this process first saw the session start. Absent until it does. */
  since?: number
}

declare module 'claude-code' {
  interface PluginState {
    'wrapped': { pending: Pending; session: SessionMemo }
  }
}
