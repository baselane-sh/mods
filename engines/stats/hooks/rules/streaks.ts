import { addDays } from '../date'
import type { StatsRule, View } from '../rule'
import { dayNumber, hasTurn, longestRun, span } from '../streak'

const RECENT = 14

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const compose = ({ days, date }: View): string => {
  const first = Object.keys(days).sort()[0] ?? date
  const best = longestRun(days, span(first, date))
  const cells = span(addDays(date, -(RECENT - 1)), date)
    .map(d => (hasTurn(days, d) ? '#' : '.'))
    .join('')
  return [
    `Day ${dayNumber(days, date)} streak (best ${plural(best, 'day')})`,
    `last ${RECENT} days  ${cells}`,
    ...(hasTurn(days, date) ? [] : ['Send a prompt today to keep it going.']),
  ].join('\n')
}

export const rule: StatsRule = {
  id: 'streaks',
  command: { name: 'streak', description: 'Show your streak of consecutive days with Claude Code', compose },
  // The toast is for a session start only: a turn end does not repeat it.
  after: async ({ event, days, date }) => (event === 'session' ? [`Day ${dayNumber(days, date)} streak`] : []),
}
