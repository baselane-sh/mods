import type { BandRule } from '../rule'

// The share of the prompt tokens the cache served, over the whole session.
// `$.session.usage()` has no cache figures, so the engine hands each turn's
// own (`turn.complete`'s usage) to this rule, which adds them up in the
// reading. A /clear starts the session over, and so the sum.
export const rule: BandRule = {
  id: 'cache-meter',
  atTurnEnd: async ({ reading, previous, usage }) => {
    const isSame = previous.startedAt === reading.startedAt
    const [read, total] = isSame ? [previous.cacheRead ?? 0, previous.cacheTotal ?? 0] : [0, 0]
    if (usage === undefined) return total > 0 ? { cacheRead: read, cacheTotal: total } : {}
    return { cacheRead: read + usage.cacheRead, cacheTotal: total + usage.input + usage.cacheRead + usage.cacheWrite }
  },
  segment: ({ reading }) =>
    reading.cacheTotal === undefined || reading.cacheTotal <= 0
      ? undefined
      : { key: 'cache-meter', text: `cache ${Math.round((100 * (reading.cacheRead ?? 0)) / reading.cacheTotal)}%` },
}
