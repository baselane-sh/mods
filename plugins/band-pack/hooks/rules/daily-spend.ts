import type { BandRule } from '../rule'
import { dollars } from '../money'

const keyFor = (date: string): string => `daily:${date}`

// Today's total across sessions. The store holds one number per local date;
// each turn adds its own cost delta once (the engine measures it from the
// cost at turn start, so a turn that ends twice has a delta of zero the
// second time). Two sessions ending a turn in the same instant can lose one
// add: the store has no atomic update.
export const rule: BandRule = {
  id: 'daily-spend',
  atTurnEnd: async ({ turnUsd, date, store }) => {
    const stored = await store.get(keyFor(date))
    const total = typeof stored === 'number' && Number.isFinite(stored) ? stored : undefined
    if (turnUsd !== undefined && turnUsd > 0) {
      const next = (total ?? 0) + turnUsd
      await store.set(keyFor(date), next)
      return { dailyUsd: next, dailyDate: date }
    }
    return total === undefined ? {} : { dailyUsd: total, dailyDate: date }
  },
  segment: ({ reading, date }) =>
    reading.dailyUsd === undefined || reading.dailyDate !== date
      ? undefined
      : { key: 'daily-spend', text: `today ${dollars(reading.dailyUsd)}` },
}
