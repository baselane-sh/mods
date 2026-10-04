import { addDays, weekday } from '../date'
import type { Composed, StatsRule, View } from '../rule'
import { longestRun, span } from '../streak'

const WIDTH = 36
const SIGNATURE = 'made with Claude Code + baselane.sh'
const MAX_TOOL_NAME = 18

const PERIODS = { '': 7, week: 7, month: 30 } as const

const row = (label: string, value: string): string => `${label}${' '.repeat(Math.max(1, WIDTH - label.length - value.length))}${value}`
const center = (text: string): string => `${' '.repeat(Math.max(0, Math.floor((WIDTH - text.length) / 2)))}${text}`
const bar = (char: string): string => char.repeat(WIDTH)
const short = (text: string): string => (text.length > MAX_TOOL_NAME ? `${text.slice(0, MAX_TOOL_NAME - 1)}~` : text)

const compose = ({ days, date }: View, args: string): Composed => {
  const key = args.trim().toLowerCase()
  if (!(key in PERIODS)) return { text: `wrapped: unknown option "${args.trim()}". Use /wrapped or /wrapped month.`, copy: false }
  const length = PERIODS[key as keyof typeof PERIODS]

  const dates = span(addDays(date, -(length - 1)), date)
  const inRange = dates.flatMap(d => {
    const day = days[d]
    return day === undefined ? [] : [{ date: d, day }]
  })
  const sum = (pick: (day: (typeof inRange)[number]['day']) => number): number => inRange.reduce((total, { day }) => total + pick(day), 0)

  // Ties go to the later day.
  const busiest = inRange.reduce<(typeof inRange)[number] | undefined>(
    (best, entry) => (entry.day.calls > 0 && (best === undefined || entry.day.calls >= best.day.calls) ? entry : best),
    undefined,
  )
  const tools: Record<string, number> = {}
  for (const { day } of inRange) for (const [name, n] of Object.entries(day.tools)) tools[name] = (tools[name] ?? 0) + n
  const top = Object.entries(tools).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0]
  const streak = longestRun(days, dates)
  const costs = inRange.flatMap(({ day }) => (day.usd === undefined ? [] : [day.usd]))

  return [
    bar('='),
    center('CLAUDE CODE WRAPPED'),
    center(`last ${length} days`),
    bar('='),
    row('sessions', String(sum(day => day.sessions))),
    row('turns', String(sum(day => day.turns))),
    row('tool calls', String(sum(day => day.calls))),
    row('files touched', String(sum(day => day.files))),
    row('tests passed', String(sum(day => day.passed))),
    row('tests failed', String(sum(day => day.failed))),
    row('blocked calls', String(sum(day => day.blocked))),
    bar('-'),
    row('busiest day', busiest === undefined ? 'none' : `${weekday(busiest.date)} ${busiest.date.slice(5)}, ${busiest.day.calls} calls`),
    row('top tool', top === undefined ? 'none' : `${short(top[0])} (${top[1]})`),
    row('longest streak', `${streak} ${streak === 1 ? 'day' : 'days'}`),
    ...(costs.length === 0 ? [] : [row('cost', `$${costs.reduce((a, b) => a + b, 0).toFixed(2)}`)]),
    bar('='),
    SIGNATURE,
  ]
    .map(line => line.trimEnd())
    .join('\n')
}

export const rule: StatsRule = {
  id: 'wrapped',
  command: { name: 'wrapped', description: 'Print Claude Code Wrapped for the last 7 days (month for 30) and copy it', copy: true, compose },
}
