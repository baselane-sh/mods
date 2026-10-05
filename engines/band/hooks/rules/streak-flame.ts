import type { BandRule } from '../rule'

const KEY = 'streak'
const DATE = /^\d{4}-\d{2}-\d{2}$/

type Streak = { last: string; days: number }

const two = (n: number): string => String(n).padStart(2, '0')

// The calendar day before a YYYY-MM-DD. Built from the date's parts, so a
// daylight saving change cannot skip or repeat a day.
export const previousDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)
  const before = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 1)
  return `${before.getFullYear()}-${two(before.getMonth() + 1)}-${two(before.getDate())}`
}

// The store is the person's disk: a value that is not a streak is ignored.
const parse = (stored: unknown): Streak | undefined => {
  if (typeof stored !== 'object' || stored === null) return undefined
  const { last, days } = stored as { last?: unknown; days?: unknown }
  return typeof last === 'string' && DATE.test(last) && Number.isInteger(days) && (days as number) >= 1
    ? { last, days: days as number }
    : undefined
}

const advance = (held: Streak | undefined, date: string): Streak => {
  if (held === undefined) return { last: date, days: 1 }
  // A clock that went back keeps the streak as it is.
  if (held.last >= date) return held
  return { last: date, days: held.last === previousDate(date) ? held.days + 1 : 1 }
}

// The daily streak: how many days in a row you finished a turn. The mod keeps
// `{ last, days }` in its own store and moves it at each turn end.
export const rule: BandRule = {
  id: 'streak-flame',
  atTurnEnd: async ({ date, store }) => {
    const held = parse(await store.get(KEY))
    const next = advance(held, date)
    if (next !== held) await store.set(KEY, next)
    return { streak: next.days, streakDate: next.last }
  },
  // A streak whose last day is before yesterday has already ended.
  segment: ({ reading, date }) =>
    reading.streak === undefined || (reading.streakDate !== date && reading.streakDate !== previousDate(date))
      ? undefined
      : { key: 'streak-flame', text: `🔥 ${reading.streak}d` },
}
