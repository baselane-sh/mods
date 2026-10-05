import type { Fetched } from '../../types'
import { bar, cellsOf } from '../bar'
import { bdJson, isCount, ranBd, summaryOf } from '../beads'
import type { BandRule } from '../rule'

const CELLS = 10

// Closed beads of all, as a bar and a percent that reads 100 only when all are closed.
export const doneLine = (status: unknown): Fetched | null => {
  const summary = summaryOf(status)
  if (summary === null) return null
  const { closed_issues: closed, total_issues: total } = summary
  if (!isCount(closed) || !isCount(total) || total === 0) return null
  const part = Math.min(closed, total)
  const percent = Math.floor((part * 100) / total)
  return {
    text: `beads ${bar(cellsOf(part, total, CELLS), CELLS)} ${percent}%`,
    ...(part === total ? { color: 'green' } : {}),
  }
}

// How much of the beads project is closed, read with `bd status` every two
// minutes and after a Bash call that ran bd. No beads, no bd or no beads
// project: hidden.
export const rule: BandRule = {
  id: 'beads-done-bar',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    onEditWhen: ranBd,
    timeoutMs: 10_000,
    read: async (run, _git, now, generation) => doneLine(await bdJson(run, ['status'], { now, generation })),
  },
  segment: ({ fetched }) => {
    const found = fetched['beads-done-bar']
    if (found === null || found === undefined) return undefined
    return { key: 'beads-done-bar', text: found.text, ...(found.color === undefined ? {} : { color: found.color }) }
  },
}
