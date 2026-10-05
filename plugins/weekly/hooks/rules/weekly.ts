import type { Day } from '../../types'
import { addDays, weekday } from '../date'
import type { Days, StatsRule, View } from '../rule'
import { span } from '../streak'

// This week against last week. Weeks start on Monday; this week runs from its
// Monday to today, last week is the seven days before that Monday.
const DAYS_FROM_MONDAY: Readonly<Record<string, number>> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
const LABEL_WIDTH = 12
const COLUMN = 11

type Totals = { sessions: number; turns: number; calls: number; files: number; usd?: number }

const totalOf = (days: Days, dates: readonly string[]): Totals => {
  const present = dates.flatMap(date => (days[date] === undefined ? [] : [days[date] as Day]))
  const costs = present.flatMap(each => (each.usd === undefined ? [] : [each.usd]))
  const sum = (pick: (each: Day) => number): number => present.reduce((total, each) => total + pick(each), 0)
  return {
    sessions: sum(each => each.sessions),
    turns: sum(each => each.turns),
    calls: sum(each => each.calls),
    files: sum(each => each.files),
    ...(costs.length === 0 ? {} : { usd: costs.reduce((total, usd) => total + usd, 0) }),
  }
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))

const money = (usd: number): string => `$${usd.toFixed(2)}`

const signedMoney = (usd: number): string => {
  const cents = Math.round(usd * 100)
  if (cents === 0) return '$0.00'
  return `${cents > 0 ? '+' : '-'}${money(Math.abs(cents) / 100)}`
}

const row = (label: string, cells: readonly string[]): string => `${label.padEnd(LABEL_WIDTH)}${cells.map(cell => cell.padStart(COLUMN)).join('')}`

const countRow = (label: string, now: number, before: number): string => row(label, [String(now), String(before), signed(now - before)])

const costRow = (now: number | undefined, before: number | undefined): string =>
  row('cost', [
    now === undefined ? '?' : money(now),
    before === undefined ? '?' : money(before),
    now === undefined || before === undefined ? '?' : signedMoney(now - before),
  ])

const compose = ({ days, date }: View): string => {
  const monday = addDays(date, -(DAYS_FROM_MONDAY[weekday(date)] ?? 0))
  const now = totalOf(days, span(monday, date))
  const before = totalOf(days, span(addDays(monday, -7), addDays(monday, -1)))
  return [
    `This week (since Mon ${monday}) against last week`,
    row('', ['this week', 'last week', 'change']),
    countRow('sessions', now.sessions, before.sessions),
    countRow('turns', now.turns, before.turns),
    countRow('tool calls', now.calls, before.calls),
    countRow('files edited', now.files, before.files),
    costRow(now.usd, before.usd),
  ].join('\n')
}

export const rule: StatsRule = {
  id: 'weekly',
  command: {
    name: 'week',
    description: 'Show this week against last week: sessions, turns, tool calls, files edited and cost',
    copy: false,
    compose,
  },
}
