import type { Nudge } from '../engine'

// Suggests a break at turn end once the session has run this long, and again
// each time another period passes.
export const PERIOD_MS = 90 * 60_000

export const create = (): Nudge => {
  let reminded = 0

  return {
    id: 'break-nudge',
    atStop: async tools => {
      const [now, startedAt] = await Promise.all([tools.now(), tools.sessionStartedAt()])
      const periods = Math.floor((now - startedAt) / PERIOD_MS)
      if (periods <= reminded) return undefined
      reminded = periods // skipped periods (a long turn) still count as one reminder
      return `This session has run ${periods * 90} minutes. Take a short break.`
    },
  }
}
