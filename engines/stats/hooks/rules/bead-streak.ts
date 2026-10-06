import { addDays } from '../date'
import { closesBead } from '../bead'
import type { Call, StatsRule, View } from '../rule'
import { span } from '../streak'

// Days with a closed bead, kept in the mod's own store: `bead-days` maps a
// local date to how many successful `bd close` calls ran that day, and
// `bead-best` is the longest streak so far (kept apart because old days are
// pruned). The first streak is the mark to beat and toasts nothing, as in
// personal-bests.
const DAYS_KEY = 'bead-days'
const BEST_KEY = 'bead-best'
const KEEP_DAYS = 400
const RECENT = 14

type BeadDays = Readonly<Record<string, number>>

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

// The store is outside this code: an entry that is not a date with a count above 0 is dropped.
const readDays = (raw: unknown): BeadDays =>
  isRecord(raw)
    ? Object.fromEntries(
        Object.entries(raw).filter(([date, n]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof n === 'number' && Number.isFinite(n) && n > 0),
      ) as BeadDays
    : {}

const readBest = (raw: unknown): number => (typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : 0)

const hasClose = (days: BeadDays, date: string): boolean => (days[date] ?? 0) > 0

// Consecutive days with a close, counting back from `date` (0 when `date` has none).
const runEndingAt = (days: BeadDays, date: string): number => {
  let n = 0
  while (hasClose(days, addDays(date, -n))) n += 1
  return n
}

// The streak that is alive on `date`: today's run, or yesterday's while today is still open.
const currentStreak = (days: BeadDays, date: string): number =>
  hasClose(days, date) ? runEndingAt(days, date) : runEndingAt(days, addDays(date, -1))

const longestRun = (days: BeadDays, date: string): number => {
  const first = Object.keys(days).sort()[0]
  if (first === undefined) return 0
  let best = 0
  let run = 0
  for (const d of span(first, date)) {
    run = hasClose(days, d) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

const pruned = (days: BeadDays, date: string): BeadDays => {
  const oldest = addDays(date, -(KEEP_DAYS - 1))
  return Object.fromEntries(Object.entries(days).filter(([d]) => d >= oldest))
}

const compose = async ({ date, store }: View): Promise<string> => {
  const days = readDays(await store.get(DAYS_KEY))
  const streak = currentStreak(days, date)
  const best = Math.max(readBest(await store.get(BEST_KEY)), longestRun(days, date))
  const cells = span(addDays(date, -(RECENT - 1)), date)
    .map(d => (hasClose(days, d) ? '#' : '.'))
    .join('')
  const hint = !hasClose(days, date) ? [streak > 0 ? 'Close a bead today to keep it going.' : 'Close a bead with bd close to start a streak.'] : []
  return [`Bead streak: ${plural(streak, 'day')} (best ${plural(best, 'day')})`, `last ${RECENT} days  ${cells}`, ...hint].join('\n')
}

// A close that ended with exit 0: count the day, and say so when the streak passes its best.
const onCall = async ({ tool, command, ok, date, store }: Call): Promise<readonly string[]> => {
  if (tool !== 'Bash' || !ok || command === undefined || !closesBead(command)) return []
  const days = readDays(await store.get(DAYS_KEY))
  const isNewDay = !hasClose(days, date)
  const kept = pruned({ ...days, [date]: (days[date] ?? 0) + 1 }, date)
  await store.set(DAYS_KEY, kept)
  if (!isNewDay) return []

  const streak = runEndingAt(kept, date)
  const best = Math.max(readBest(await store.get(BEST_KEY)), longestRun(days, date))
  if (streak <= best) return []
  await store.set(BEST_KEY, streak)
  return best > 0 ? [`New best bead streak: ${plural(streak, 'day')}`] : []
}

export const rule: StatsRule = {
  id: 'bead-streak',
  command: {
    name: 'bead-streak',
    description: 'Show your streak of consecutive days with a closed bead',
    compose,
  },
  call: onCall,
}
