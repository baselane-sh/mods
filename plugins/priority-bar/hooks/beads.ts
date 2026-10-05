// Reads of the beads issue tracker (`bd`). Only read commands, always with
// --json. No bd, no beads project (exit 1), a failed or empty answer or JSON
// that does not parse: null, and the rule hides.
import type { ProcessRunResult } from 'claude-code'

import type { EditCall } from './rule'

export type Run = (argv: readonly string[]) => Promise<ProcessRunResult>

// Text in quotes is an argument, never a command.
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g
// `bd` as a command word: at the start, after a separator (; & | ( or a new
// line, so also && || and $( ), after NAME=value prefixes, or as a path
// ending in /bd.
const BD_WORD = /(?:^|[;&|(\n])\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:\S*\/)?bd(?=$|[\s;&|)])/

// Whether a tool call ran bd, so the beads figures may have moved.
export const ranBd = (call: EditCall): boolean =>
  call.tool === 'Bash' && typeof call.command === 'string' && BD_WORD.test(call.command.replace(QUOTED, "''"))

const SHARE_MS = 3000

// When a read starts: the clock, and the fetcher's edit generation.
export type ReadAt = { now: number; generation: number }

// Runs the rules of one mod share: the same argv started within 3 s of another
// in the same edit generation reuses that run, so a pack runs each bd command
// once per refresh, and a read after Claude ran bd never reuses one from
// before it. Bookkeeping, not drawn state; a hot reload resets it.
const shared = new Map<string, ReadAt & { ran: Promise<ProcessRunResult> }>()

const isFresh = (held: ReadAt, at: ReadAt): boolean => held.generation === at.generation && Math.abs(at.now - held.now) < SHARE_MS

const runShared = (run: Run, argv: readonly string[], at: ReadAt): Promise<ProcessRunResult> => {
  const key = argv.join('\u0000')
  const held = shared.get(key)
  if (held !== undefined && isFresh(held, at)) return held.ran
  for (const [old, entry] of shared) if (!isFresh(entry, at)) shared.delete(old)
  const ran = run(argv)
  shared.set(key, { ...at, ran })
  return ran
}

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

export const bdJson = async (run: Run, args: readonly string[], at: ReadAt): Promise<unknown> => {
  const ran = await runShared(run, ['bd', ...args, '--json'], at)
  if (ran.exitCode !== 0 || ran.stdout.trim() === '') return null
  try {
    return JSON.parse(ran.stdout) as unknown
  } catch {
    return null
  }
}

// What `bd status --json` counts, or null.
export const summaryOf = (status: unknown): Readonly<Record<string, unknown>> | null =>
  isRecord(status) && isRecord(status['summary']) ? status['summary'] : null

const TITLE_CHARS = 40

// Text from bd is free text: one line, no control characters.
export const oneLine = (text: string): string =>
  text.replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()

// A title cut to 40 characters at most, the cut marked.
export const cutTitle = (title: string): string => {
  const line = [...oneLine(title)]
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS - 1).join('')}…` : line.join('')
}

export type Bead = { id: string; title: string; updatedAt: string; parent?: string }

const beadOf = (item: unknown): Bead | null => {
  if (!isRecord(item)) return null
  const { id, title, updated_at: updatedAt, parent } = item
  if (typeof id !== 'string' || oneLine(id) === '' || typeof title !== 'string') return null
  return { id: oneLine(id), title, updatedAt: typeof updatedAt === 'string' ? updatedAt : '', ...(typeof parent === 'string' ? { parent } : {}) }
}

export const IN_PROGRESS = ['list', '--status', 'in_progress', '--limit', '0']

// The beads of `bd list --json`, the one updated last first (ISO times sort
// as text; a tie goes to the id, so the pick does not flicker).
export const latestFirst = (list: unknown): readonly Bead[] | null => {
  if (!Array.isArray(list)) return null
  return list
    .map(beadOf)
    .filter((bead): bead is Bead => bead !== null)
    .sort((a, b) => (a.updatedAt === b.updatedAt ? a.id.localeCompare(b.id) : a.updatedAt < b.updatedAt ? 1 : -1))
}
