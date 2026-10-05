import type { Day } from '../types'
import { addDays } from './date'

type Days = Readonly<Record<string, Day>>

export const hasTurn = (days: Days, date: string): boolean => (days[date]?.turns ?? 0) > 0

// Consecutive days with a turn, counting back from `date` (0 when `date` has none).
export const runEndingAt = (days: Days, date: string): number => {
  let n = 0
  while (hasTurn(days, addDays(date, -n))) n += 1
  return n
}

// "Day N": today's run when today has a turn, else yesterday's run plus today,
// which the person is about to start. A missed day leaves yesterday's run at 0.
export const dayNumber = (days: Days, today: string): number =>
  hasTurn(days, today) ? runEndingAt(days, today) : runEndingAt(days, addDays(today, -1)) + 1

// The longest run of days with a turn anywhere in `dates`, oldest first.
export const longestRun = (days: Days, dates: readonly string[]): number => {
  let best = 0
  let run = 0
  for (const date of dates) {
    run = hasTurn(days, date) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// Every date from `from` to `to`, inclusive, oldest first.
export const span = (from: string, to: string): string[] => {
  const dates: string[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}
