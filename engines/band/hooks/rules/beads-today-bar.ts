import type { PluginOptions } from 'claude-code'

import { bar, cellsOf } from '../bar'
import { bdJson, isCount, isRecord } from '../beads'
import { localDate } from '../date'
import type { BandRule } from '../rule'

export const DEFAULT_DAILY_GOAL = 5
const MIN_GOAL = 1
const MAX_GOAL = 50
const MAX_CELLS = 10

export const goalOf = (options: PluginOptions): number => {
  const set = options['dailyGoal']
  return typeof set === 'number' && Number.isFinite(set) ? Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(set))) : DEFAULT_DAILY_GOAL
}

// Beads closed today against the goal: one cell per bead up to ten cells.
export const todayLine = (count: number, goal: number): { text: string; color?: string } => {
  const cells = Math.min(goal, MAX_CELLS)
  const isMet = count >= goal
  return { text: `today ${bar(cellsOf(count, goal, cells), cells, '▮', '▯')} ${count}/${goal}`, ...(isMet ? { color: 'green' } : {}) }
}

// Beads closed since local midnight, read with `bd count --closed-after` every
// two minutes and after each Bash call or edit. bd reads a bare date as local
// midnight and counts what closed after it. The figure keeps the date it is
// for, so yesterday's count is not drawn after midnight. No bd or no beads
// project: hidden.
export const rule: BandRule = {
  id: 'beads-today-bar',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    timeoutMs: 10_000,
    read: async (run, _git, now) => {
      const date = localDate(now)
      const answer = await bdJson(run, ['count', '--closed-after', date])
      const count = isRecord(answer) ? answer['count'] : undefined
      return isCount(count) ? { text: String(count), tag: date } : null
    },
  },
  segment: ({ fetched, date, options }) => {
    const found = fetched['beads-today-bar']
    if (found === null || found === undefined || found.tag !== date) return undefined
    return { key: 'beads-today-bar', ...todayLine(Number(found.text), goalOf(options)) }
  },
}
