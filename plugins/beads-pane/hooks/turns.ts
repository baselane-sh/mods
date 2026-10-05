import type { TurnCost } from '../types'

// The turn ledger: each turn's cost is the session cost at its end less the
// cost at its start, as the session cost is the only dollar figure the host
// gives. Pure: the engine reads and writes the ledger in `$.state`.

// Enough for a long session's average; the oldest drop off.
export const MAX_TURNS = 200

// A turn begins. A second start of the same turn changes nothing. `at`, when
// given, is kept as the turn's start.
export const startTurn = (ledger: readonly TurnCost[], turnId: string, usd: number | undefined, at?: number): TurnCost[] => {
  if (ledger.some(turn => turn.turnId === turnId)) return [...ledger]
  const n = (ledger.at(-1)?.n ?? 0) + 1
  return [...ledger, { turnId, n, startUsd: usd ?? null, ended: false, ...(at === undefined ? {} : { startedAt: at, tools: 0 }) }].slice(
    -MAX_TURNS,
  )
}

// A turn ends. A turn the ledger never saw begin, or one already ended, is
// left alone; a cost that fell (a cleared session) leaves it unmeasured.
export const endTurn = (ledger: readonly TurnCost[], turnId: string, usd: number | undefined, at?: number): TurnCost[] =>
  ledger.map(turn => {
    if (turn.turnId !== turnId || turn.ended) return turn
    const start = turn.startUsd
    const measured = usd !== undefined && start !== null && usd >= start
    return { ...turn, ended: true, ...(measured ? { usd: usd - start } : {}), ...(at === undefined ? {} : { endedAt: at }) }
  })

// One more tool call in the running turn: the newest, while it has not ended.
// A call between turns belongs to none.
export const countTool = (ledger: readonly TurnCost[]): TurnCost[] => {
  const last = ledger.at(-1)
  if (last === undefined || last.ended) return [...ledger]
  return [...ledger.slice(0, -1), { ...last, tools: (last.tools ?? 0) + 1 }]
}
