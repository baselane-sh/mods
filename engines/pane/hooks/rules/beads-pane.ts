import type { PaneLine } from '../../types'
import { BD_GAP_MS, NO_ANSWER, PRIORITY_COLORS, beadsOf, byPriority, readBd, refreshAfterBash } from '../beads'
import type { Bead } from '../beads'
import { clean, line, ruleLine } from '../lines'
import type { PaneHost, PaneRule } from '../rule'

// The beads (bd issues) in progress, ready and blocked, read with three
// read-only bd calls, one after the other: bd's embedded database takes one
// reader at a time best. Each section shows at most MAX_SHOWN, the footer
// counts every issue of each list.
const MAX_SHOWN = 10

type Section = { key: string; title: string; color: string; args: readonly string[] }

export const SECTIONS: readonly Section[] = [
  { key: 'progress', title: 'In progress', color: 'cyan', args: ['list', '--status', 'in_progress', '--limit', '0'] },
  { key: 'ready', title: 'Ready', color: 'green', args: ['ready', '--limit', '0'] },
  { key: 'blocked', title: 'Blocked', color: 'red', args: ['blocked'] },
]

const beadLine = (section: string, bead: Bead, idWidth: number): PaneLine =>
  line(
    `${section}-${bead.id}`,
    { text: `  ${clean(bead.id).padEnd(idWidth)}  ` },
    { text: `P${bead.priority}`, bold: true, ...(PRIORITY_COLORS[bead.priority] === undefined ? {} : { color: PRIORITY_COLORS[bead.priority] }) },
    { text: `  ${clean(bead.title)}` },
  )

// The section's title, its first MAX_SHOWN issues by priority then age, and
// a count of the rest.
export const sectionLines = (section: Section, beads: readonly Bead[]): PaneLine[] => {
  const shown = [...beads].sort(byPriority).slice(0, MAX_SHOWN)
  const idWidth = Math.max(0, ...shown.map(bead => bead.id.length))
  const rest = beads.length - shown.length
  return [
    line(`head-${section.key}`, { text: section.title, bold: true, color: section.color }),
    ...(shown.length === 0 ? [line(`none-${section.key}`, { text: '  none', dim: true })] : shown.map(bead => beadLine(section.key, bead, idWidth))),
    ...(rest > 0 ? [line(`more-${section.key}`, { text: `  … and ${rest} more`, dim: true })] : []),
  ]
}

const footer = (counts: readonly number[]): PaneLine =>
  line('counts', { text: SECTIONS.map((section, i) => `${counts[i] ?? 0} ${section.title.toLowerCase()}`).join('   '), dim: true })

const load = async (host: PaneHost): Promise<PaneLine[]> => {
  const cwd = await host.cwd()
  const lists: Bead[][] = []
  for (const section of SECTIONS) {
    const read = await readBd(host, cwd, section.args)
    // The first failure is the pane's one line; the other reads do not run.
    if (!read.ok) return read.lines
    const beads = beadsOf(read.value)
    if (beads === undefined) return [line('bd-failed', { text: NO_ANSWER, dim: true })]
    lists.push(beads)
  }
  return [
    ...SECTIONS.flatMap((section, i) => [...(i === 0 ? [] : [ruleLine(`gap-${section.key}`)]), ...sectionLines(section, lists[i] ?? [])]),
    ruleLine('gap-counts'),
    footer(lists.map(list => list.length)),
  ]
}

export const rule: PaneRule = {
  id: 'beads-pane',
  pane: {
    id: 'beads',
    title: 'Beads',
    command: 'beads',
    description: 'Show or hide the Beads pane: issues in progress, ready and blocked, read with bd',
    empty: 'Reading beads…',
  },
  minGapMs: BD_GAP_MS,
  refreshAfter: refreshAfterBash,
  load,
}
