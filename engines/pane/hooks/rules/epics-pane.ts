import type { PaneLine } from '../../types'
import { BD_GAP_MS, NO_ANSWER, readBd, refreshAfterBash } from '../beads'
import { clean, line } from '../lines'
import type { PaneHost, PaneRule } from '../rule'

// Every open epic with how many of its children are closed, read with one
// read-only `bd epic status --json`.
const BAR_CELLS = 8
const READY_MARK = 'ready to close'

export type Epic = { id: string; title: string; priority: number; closed: number; total: number; eligible: boolean }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const count = (value: unknown): number => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0)

// One entry of `bd epic status --json`, or undefined for one that is closed
// or has no id, title or priority.
export const epicOf = (value: unknown): Epic | undefined => {
  if (!isRecord(value) || !isRecord(value.epic)) return undefined
  const { id, title, priority, status } = value.epic
  if (typeof id !== 'string' || id.length === 0 || typeof title !== 'string') return undefined
  if (typeof priority !== 'number' || !Number.isInteger(priority) || status === 'closed') return undefined
  const total = count(value.total_children)
  return { id, title, priority, total, closed: Math.min(count(value.closed_children), total), eligible: value.eligible_for_close === true }
}

export const epicsOf = (value: unknown): Epic[] | undefined => {
  if (value === null) return []
  if (!Array.isArray(value)) return undefined
  return value.flatMap(each => {
    const epic = epicOf(each)
    return epic === undefined ? [] : [epic]
  })
}

const doneShare = (epic: Epic): number => (epic.total === 0 ? 0 : epic.closed / epic.total)

// Priority first (0 is the highest), then the nearest to done, then the
// fewest children left, then the id.
export const byPriorityThenDone = (a: Epic, b: Epic): number =>
  a.priority - b.priority || doneShare(b) - doneShare(a) || a.total - a.closed - (b.total - b.closed) || a.id.localeCompare(b.id)

// Full cells for the closed share, rounded down: a full bar means all closed.
export const barCells = (closed: number, total: number): number => (total === 0 ? 0 : Math.floor((closed * BAR_CELLS) / total))

const epicLine = (epic: Epic, idWidth: number, countWidth: number): PaneLine => {
  const full = barCells(epic.closed, epic.total)
  return line(
    `epic-${epic.id}`,
    { text: `${clean(epic.id).padEnd(idWidth)}  `, color: 'cyan', bold: true },
    { text: '█'.repeat(full), color: 'green' },
    { text: '░'.repeat(BAR_CELLS - full), dim: true },
    { text: `  ${`${epic.closed}/${epic.total}`.padStart(countWidth)}` },
    ...(epic.eligible ? [{ text: `  ${READY_MARK}`, color: 'green', bold: true }] : []),
    { text: `  ${clean(epic.title)}` },
  )
}

export const epicLines = (epics: readonly Epic[]): PaneLine[] => {
  if (epics.length === 0) return [line('none', { text: 'No open epics.', dim: true })]
  const sorted = [...epics].sort(byPriorityThenDone)
  const idWidth = Math.max(...sorted.map(epic => epic.id.length))
  const countWidth = Math.max(...sorted.map(epic => `${epic.closed}/${epic.total}`.length))
  const ready = sorted.filter(epic => epic.eligible).length
  const head = `${sorted.length} open ${sorted.length === 1 ? 'epic' : 'epics'}${ready > 0 ? `, ${ready} ${READY_MARK}` : ''}`
  return [line('count', { text: head, bold: true }), ...sorted.map(epic => epicLine(epic, idWidth, countWidth))]
}

const load = async (host: PaneHost): Promise<PaneLine[]> => {
  const read = await readBd(host, await host.cwd(), ['epic', 'status'])
  if (!read.ok) return read.lines
  const epics = epicsOf(read.value)
  return epics === undefined ? [line('bd-failed', { text: NO_ANSWER, dim: true })] : epicLines(epics)
}

export const rule: PaneRule = {
  id: 'epics-pane',
  pane: {
    id: 'epics',
    title: 'Epics',
    command: 'epics',
    description: 'Show or hide the Epics pane: each open epic with its closed and total children, read with bd',
    empty: 'Reading epics…',
  },
  minGapMs: BD_GAP_MS,
  refreshAfter: refreshAfterBash,
  load,
}
