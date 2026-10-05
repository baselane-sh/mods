import type { Timer } from 'claude-code'

const SECOND_MS = 1000

// The one-second tick of the running turn, a handle like the minute tick.
// A hot reload cancels it; the next turn start starts it again.
let secondTick: Timer | undefined

export const stopTurnTimer = (): void => {
  secondTick?.cancel()
  secondTick = undefined
}

// What the timer needs, as closures over `$`: `$` itself is never passed on.
export type TurnTimerDeps = {
  now: () => Promise<number>
  // Keeps when the turn began (null: no turn runs).
  begin: (at: number | null) => Promise<unknown>
  every: (ms: number, fn: () => void) => Timer
  // One redraw of the band.
  tick: () => Promise<void>
}

// Keeps when the person's turn began for the rules that draw it, and redraws
// the band each second while it runs. A subagent raises no turn.start, and its
// turn.complete leaves the timer alone (the engine passes only the main loop's).
export const startTurnTimer = async (deps: TurnTimerDeps): Promise<void> => {
  stopTurnTimer()
  await deps.begin(await deps.now())
  secondTick = deps.every(SECOND_MS, () => void deps.tick())
}
