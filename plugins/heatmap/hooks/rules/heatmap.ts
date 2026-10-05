import { addDays, weekday } from '../date'
import type { Days, StatsRule, View } from '../rule'

// A contribution-style grid of the last 12 weeks: one column a week, Monday
// on top, today's week on the right. A day is active once it has a turn (as
// for streaks) and is shaded by its turns against the busiest day shown.
const WEEKS = 12
const SHADES = ['░', '▒', '▓', '█'] as const
const NONE = '·'
const ROWS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const LABEL = '    '

const turnsOn = (days: Days, date: string): number => days[date]?.turns ?? 0

// Monday of the week `date` falls in.
const mondayOf = (date: string): string => addDays(date, -ROWS.indexOf(weekday(date) as (typeof ROWS)[number]))

const shade = (turns: number, most: number): string =>
  turns <= 0 ? NONE : (SHADES[Math.min(SHADES.length, Math.ceil((turns / most) * SHADES.length)) - 1] ?? NONE)

// The month a column starts, named above it: the week holding a month's 1st.
const monthRow = (mondays: readonly string[]): string => {
  const cells = Array<string>(mondays.length * 2 - 1).fill(' ')
  const named = mondays.reduce((row, monday, column) => {
    const first = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).find(date => date.endsWith('-01'))
    if (first === undefined) return row
    const name = MONTHS[Number(first.slice(5, 7)) - 1] ?? ''
    return [...row.slice(0, column * 2), ...name, ...row.slice(column * 2 + name.length)]
  }, cells)
  return `${LABEL}${named.join('')}`.trimEnd()
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const compose = ({ days, date }: View): string => {
  const first = addDays(mondayOf(date), -7 * (WEEKS - 1))
  const mondays = Array.from({ length: WEEKS }, (_, week) => addDays(first, week * 7))
  const shown = mondays.flatMap(monday => Array.from({ length: 7 }, (_, i) => addDays(monday, i))).filter(each => each <= date)
  const active = shown.filter(each => turnsOn(days, each) > 0)
  const most = Math.max(0, ...active.map(each => turnsOn(days, each)))
  // The latest of the busiest days.
  const busiest = active.reduce<string | undefined>((best, each) => (best === undefined || turnsOn(days, each) >= turnsOn(days, best) ? each : best), undefined)
  const rows = ROWS.map((name, row) => {
    const cells = mondays.map(monday => addDays(monday, row)).map(each => (each > date ? ' ' : shade(turnsOn(days, each), most)))
    return `${name} ${cells.join(' ')}`.trimEnd()
  })
  return [
    `Active days, last ${WEEKS} weeks: ${active.length}`,
    monthRow(mondays),
    ...rows,
    `less ${NONE} ${SHADES.join(' ')} more`,
    busiest === undefined
      ? 'No active day yet. A day counts once it has a turn.'
      : `Busiest day: ${weekday(busiest)} ${busiest}, ${plural(turnsOn(days, busiest), 'turn')}`,
  ].join('\n')
}

export const rule: StatsRule = {
  id: 'heatmap',
  command: { name: 'heatmap', description: 'Show a 12 week grid of the days you used Claude Code, naming your busiest day', copy: false, compose },
}
