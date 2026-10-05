import type { Timer } from 'claude-code'

import type { Reading } from '../types'
import type { BandRule } from './rule'

const MINUTE_MS = 60_000

// The minute tick, a module handle (not drawn state). A hot reload cancels it and
// the next turn end starts it again.
let minuteTick: Timer | undefined

// The clock as closures over `$.clock`, and `tick`, which redraws the band.
export type MinuteDeps = {
  now: () => Promise<number>
  after: (ms: number, fn: () => void) => Timer
  every: (ms: number, fn: () => void) => Timer
  tick: () => Promise<void>
}

export const stopMinuteTick = (): void => {
  minuteTick?.cancel()
  minuteTick = undefined
}

// Ticks on each minute while some rule wants it for `reading`, and stops once
// none does. The first tick waits for the next whole minute, so a clock drawn
// as HH:MM turns over when the minute does.
export const syncMinuteTick = async (rules: readonly BandRule[], reading: Reading, deps: MinuteDeps): Promise<void> => {
  // A rule that fetches on a rate needs the tick to come back to it.
  const isWanted = (rule: BandRule): boolean => rule.everyMinute?.(reading) === true || rule.fetch?.everyMs !== undefined
  if (!rules.some(isWanted)) return stopMinuteTick()
  const now = await deps.now()
  if (minuteTick !== undefined) return
  let every: Timer | undefined
  const first = deps.after(MINUTE_MS - (now % MINUTE_MS), () => {
    void deps.tick()
    every = deps.every(MINUTE_MS, () => void deps.tick())
  })
  minuteTick = {
    cancel: () => {
      first.cancel()
      every?.cancel()
    },
  }
}
