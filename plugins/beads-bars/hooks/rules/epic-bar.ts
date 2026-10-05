import type { Fetched } from '../../types'
import { bar, cellsOf } from '../bar'
import { IN_PROGRESS, bdJson, isCount, isRecord, latestFirst, oneLine, ranBd } from '../beads'
import type { BandRule } from '../rule'

const CELLS = 8

type Epic = { id: string; status: string; closed: number; total: number; isEligible: boolean }

const epicOf = (item: unknown): Epic | null => {
  if (!isRecord(item) || !isRecord(item['epic'])) return null
  const { id, status } = item['epic']
  const { closed_children: closed, total_children: total, eligible_for_close: isEligible } = item
  if (typeof id !== 'string' || oneLine(id) === '' || !isCount(closed) || !isCount(total) || total === 0) return null
  return { id: oneLine(id), status: typeof status === 'string' ? status : '', closed: Math.min(closed, total), total, isEligible: isEligible === true }
}

const ratio = (epic: Epic): number => epic.closed / epic.total

// The epic of the bead in progress (its parent, when that is an epic), else
// the open epic nearest to done that is not done. A tie goes to the id.
export const pickEpic = (epics: unknown, list: unknown): Epic | null => {
  if (!Array.isArray(epics)) return null
  const all = epics.map(epicOf).filter((epic): epic is Epic => epic !== null)
  const parent = latestFirst(list)?.[0]?.parent
  const own = parent === undefined ? undefined : all.find(epic => epic.id === parent)
  if (own !== undefined) return own
  const open = all
    .filter(epic => epic.status !== 'closed' && !epic.isEligible && epic.closed < epic.total)
    .sort((a, b) => ratio(b) - ratio(a) || a.id.localeCompare(b.id))
  return open[0] ?? null
}

export const epicLine = (epic: Epic | null): Fetched | null => {
  if (epic === null) return null
  const isDone = epic.closed >= epic.total
  return {
    text: `${epic.id} ${bar(cellsOf(epic.closed, epic.total, CELLS), CELLS)} ${epic.closed}/${epic.total}`,
    ...(isDone ? { color: 'green' } : {}),
  }
}

// One epic's progress, read with `bd epic status` and `bd list --status
// in_progress` every two minutes and after a Bash call that ran bd. No epic,
// no bd or no beads project: hidden.
export const rule: BandRule = {
  id: 'epic-bar',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    onEditWhen: ranBd,
    timeoutMs: 10_000,
    read: async (run, _git, now) => {
      const epics = await bdJson(run, ['epic', 'status'], now)
      if (!Array.isArray(epics) || epics.length === 0) return null
      return epicLine(pickEpic(epics, await bdJson(run, IN_PROGRESS, now)))
    },
  },
  segment: ({ fetched }) => {
    const found = fetched['epic-bar']
    if (found === null || found === undefined) return undefined
    return { key: 'epic-bar', text: found.text, ...(found.color === undefined ? {} : { color: found.color }) }
  },
}
