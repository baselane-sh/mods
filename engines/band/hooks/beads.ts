// Reads of the beads issue tracker (`bd`). Only read commands, always with
// --json. No bd, no beads project (exit 1), a failed or empty answer or JSON
// that does not parse: null, and the rule hides.
import type { ProcessRunResult } from 'claude-code'

export type Run = (argv: readonly string[]) => Promise<ProcessRunResult>

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

export const bdJson = async (run: Run, args: readonly string[]): Promise<unknown> => {
  const ran = await run(['bd', ...args, '--json'])
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
