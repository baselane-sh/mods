// Trimmed real answers of bd 1.2.2 (read only, on a 1,531-bead project), and
// a fake bd that answers by its read command.
import type { BandProbe, CommandReply, Surface } from './probe'

export type Reply = Exclude<CommandReply, (argv: readonly string[]) => unknown>

export const STATUS = {
  schema_version: 1,
  summary: {
    average_lead_time_hours: 0,
    blocked_issues: 29,
    closed_issues: 1354,
    deferred_issues: 7,
    epics_eligible_for_closure: 0,
    in_progress_issues: 45,
    open_issues: 125,
    pinned_issues: 0,
    ready_issues: 96,
    total_issues: 1531,
  },
}

export const LONG_TITLE =
  "[bug] intake/actions.ts is a 'use server' module that exports injectable cores (runReadBrand, runAnalyzeAssets)"

export const IN_PROGRESS = [
  { id: 'bm-lwgso.18', title: 'Portal gaps, part two', status: 'in_progress', priority: 2, issue_type: 'task', updated_at: '2026-10-05T10:40:15Z', parent: 'bm-lwgso' },
  { id: 'bm-ooq.64', title: LONG_TITLE, status: 'in_progress', priority: 3, issue_type: 'bug', updated_at: '2026-10-05T10:40:16Z', parent: 'bm-ooq' },
  { id: 'bm-1fp.3', title: 'Read three sites as rendered', status: 'in_progress', priority: 1, issue_type: 'task', updated_at: '2026-10-05T09:46:01Z', parent: 'bm-1fp' },
]

const epic = (id: string, closed: number, total: number, eligible = false) => ({
  epic: { id, title: 'The audit deliverable is trustworthy', status: 'open', priority: 1, issue_type: 'epic' },
  total_children: total,
  closed_children: closed,
  eligible_for_close: eligible,
})

export const EPICS = [epic('bm-1fp', 7, 8), epic('bm-4am1', 13, 38), epic('bm-ooq', 60, 80), epic('bm-zwf', 22, 22, true), epic('bm-nvpt', 14, 15)]

export const BY_PRIORITY = { groups: [{ count: 10, group: 'P0' }, { count: 173, group: 'P1' }, { count: 1100, group: 'P2' }, { count: 248, group: 'P3' }], schema_version: 1, total: 1531 }
export const BY_PRIORITY_CLOSED = { groups: [{ count: 10, group: 'P0' }, { count: 141, group: 'P1' }, { count: 1027, group: 'P2' }, { count: 176, group: 'P3' }], schema_version: 1, total: 1354 }

export const json = (value: unknown): { stdout: string } => ({ stdout: JSON.stringify(value, null, 2) })

// The words after `bd`, without --json: what a test keys a reply by.
export const bdKey = (argv: readonly string[]): string => argv.filter(arg => arg !== '--json').slice(1).join(' ')

export const KEYS = {
  status: 'status',
  list: 'list --status in_progress --limit 0',
  epics: 'epic status',
  priority: 'count --by-priority',
  closed: 'count --by-priority --status closed',
  today: (date: string) => `count --closed-after ${date}`,
} as const

export const REAL: Readonly<Record<string, Reply>> = {
  [KEYS.status]: json(STATUS),
  [KEYS.list]: json(IN_PROGRESS),
  [KEYS.epics]: json(EPICS),
  [KEYS.priority]: json(BY_PRIORITY),
  [KEYS.closed]: json(BY_PRIORITY_CLOSED),
  [KEYS.today('2026-10-04')]: json({ count: 3, schema_version: 1 }),
}

// A bd that answers each read command from the table; any other exits 1, as
// bd does outside a beads project.
export const fakeBd =
  (table: Readonly<Record<string, Reply>>): CommandReply =>
  argv =>
    table[bdKey(argv)] ?? { exitCode: 1 }

// The runs of one read command. In a pack the other rules run bd too.
export const bdCalls = (session: BandProbe, key: string): readonly (readonly string[])[] =>
  session.calls('bd').filter(argv => bdKey(argv) === key)

export const bdTimeouts = (session: BandProbe, key: string): readonly (number | undefined)[] => {
  const all = session.calls('bd')
  const limits = session.timeouts('bd')
  return all.flatMap((argv, at) => (bdKey(argv) === key ? [limits[at]] : []))
}

export const segmentOf = async (session: BandProbe, key: string, surface: Surface = 'terminal') => {
  const ui = await session.mount(surface, 400)
  const found = (await session.segments(ui)).find(item => item.key === key)
  await ui.unmount()
  return found
}

// A Bash call that ran bd, past the 3 s in which runs share a read.
export const afterBd = async (session: BandProbe): Promise<void> => {
  await session.advance(3000)
  await session.bash('bd close bm-1')
}
