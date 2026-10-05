import type { Fetched } from '../../types'
import { bdJson, isCount, isRecord } from '../beads'
import type { BandRule } from '../rule'

// Always named, so a P0 of 0 says so; a lower priority only when it has beads.
const ALWAYS = 4

type Group = { at: number; count: number }

const groupOf = (item: unknown): Group | null => {
  if (!isRecord(item)) return null
  const { group, count } = item
  const priority = typeof group === 'string' ? /^P(\d)$/.exec(group)?.[1] : undefined
  return priority === undefined || !isCount(count) ? null : { at: Number(priority), count }
}

// `bd count --by-priority --json` as counts by priority (0 is the highest),
// or null.
export const byPriority = (answer: unknown): readonly number[] | null => {
  if (!isRecord(answer) || !Array.isArray(answer['groups'])) return null
  const groups = answer['groups'].map(groupOf)
  if (groups.some(group => group === null)) return null
  const known = groups as readonly Group[]
  const size = Math.max(0, ...known.map(group => group.at + 1))
  return Array.from({ length: size }, (_, at) => known.filter(group => group.at === at).reduce((sum, group) => sum + group.count, 0))
}

// Beads not closed by priority: all of them less the closed ones (bd count
// takes one status only). P0 is red when any is open.
export const priorityLine = (all: unknown, closed: unknown): Fetched | null => {
  const [every, done] = [byPriority(all), byPriority(closed)]
  if (every === null || done === null) return null
  const open = every.map((count, at) => Math.max(0, count - (done[at] ?? 0)))
  if (open.every(count => count === 0)) return null
  const parts = Array.from({ length: Math.max(ALWAYS, open.length) }, (_, at) => open[at] ?? 0)
    .map((count, at) => ({ count, at }))
    .filter(({ count, at }) => at < ALWAYS || count > 0)
    .map(({ count, at }) => `P${at} ${count}`)
  return { text: parts.join(' · '), ...((open[0] ?? 0) > 0 ? { color: 'red' } : {}) }
}

// Open beads by priority, read with `bd count --by-priority` every two minutes
// and after each Bash call or edit. No open beads, no bd or no beads project:
// hidden.
export const rule: BandRule = {
  id: 'priority-bar',
  fetch: {
    everyMs: 120_000,
    onEdit: true,
    timeoutMs: 10_000,
    read: async run => {
      const all = await bdJson(run, ['count', '--by-priority'])
      if (all === null) return null
      return priorityLine(all, await bdJson(run, ['count', '--by-priority', '--status', 'closed']))
    },
  },
  segment: ({ fetched }) => {
    const found = fetched['priority-bar']
    if (found === null || found === undefined) return undefined
    return { key: 'priority-bar', text: found.text, ...(found.color === undefined ? {} : { color: found.color }) }
  },
}
