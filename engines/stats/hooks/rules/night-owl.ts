import type { After, StatsRule, View } from '../rule'

// Prompts by local hour, across sessions: store key `hours`, 24 counts.
const HOURS_KEY = 'hours'
const BAR = 20

const two = (n: number): string => String(n).padStart(2, '0')
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// The store is outside this code: a count that is not a whole number of at
// least 0 reads as 0, and a missing hour too.
export const readHours = (raw: unknown): number[] => {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: 24 }, (_, hour) => {
    const n: unknown = list[hour]
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0
  })
}

// An hour with any prompt draws at least one mark.
const marks = (n: number, most: number): string => (n === 0 ? '' : '#'.repeat(Math.max(1, Math.round((n / most) * BAR))))

// The first hour with the most prompts.
const peakOf = (hours: readonly number[]): number => hours.indexOf(Math.max(...hours))

const compose = async ({ store }: View): Promise<string> => {
  const hours = readHours(await store.get(HOURS_KEY))
  const total = hours.reduce((sum, n) => sum + n, 0)
  if (total === 0) return 'No prompts recorded yet. Your hours show here after your next prompt.'
  const most = Math.max(...hours)
  const width = String(most).length
  const peak = peakOf(hours)
  return [
    `Prompts by hour, local time (${plural(total, 'prompt')})`,
    ...hours.map((n, hour) => `${two(hour)}  ${marks(n, most).padEnd(BAR)}  ${String(n).padStart(width)}`),
    `Peak hour: ${two(peak)}:00 to ${two((peak + 1) % 24)}:00, ${most} of ${plural(total, 'prompt')} (${Math.round((most / total) * 100)}%).`,
  ].join('\n')
}

// Each turn adds one prompt to the hour it was sent in. The read-modify-write
// has the store's usual two-session window: the worst case is one prompt lost.
const after = async (ctx: After): Promise<readonly string[]> => {
  if (ctx.event !== 'turn') return []
  const hour = new Date(ctx.promptAt ?? ctx.now).getHours()
  const hours = readHours(await ctx.store.get(HOURS_KEY))
  await ctx.store.set(HOURS_KEY, hours.map((n, h) => (h === hour ? n + 1 : n)))
  return []
}

export const rule: StatsRule = {
  id: 'night-owl',
  command: { name: 'hours', description: 'Show a 24-hour histogram of when you send prompts, and your peak hour', compose },
  after,
}
