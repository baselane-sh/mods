import type { CommandTools } from './engine'

// bd on a 1,500-bead repo answers in about 0.7 s.
export const BD_TIMEOUT_MS = 10_000

// Ids that are safe as an argument: no leading dash, so bd cannot read one as a flag.
export const BEAD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export const NO_PROJECT = 'No beads project in this folder.'
export const NO_BD = 'bd is not installed.'
export const NO_ANSWER = 'bd did not answer.'

export type Bead = {
  id: string
  title: string
  status: string
  priority: number
  issue_type?: string
  created_at?: string
  parent?: string
  labels?: string[]
  description?: string
  dependency_type?: string
  dependencies?: Bead[]
  dependents?: Bead[]
}

export type BdAnswer = { ok: true; json: unknown } | { ok: false; text: string }

const fail = (text: string): BdAnswer => ({ ok: false, text })

// Runs one read-only bd command (argv only, no shell) and sorts every way it
// can go wrong into one of three plain lines. Never retries.
export const bd = async (tools: CommandTools, ...args: string[]): Promise<BdAnswer> => {
  const ran = await tools.run(['bd', ...args], BD_TIMEOUT_MS)
  if (ran.timedOut) return fail(NO_ANSWER)
  // A run that rejects without a timeout is a program that cannot start.
  if (ran.code === -1) return fail(NO_BD)
  if (ran.code !== 0) {
    const said = `${ran.stderr}\n${ran.stdout}`
    // Exit 1 outside a beads folder; other codes and other 1s are real failures.
    const noProject = ran.code === 1 && (ran.stderr.trim() === '' || /no beads|database found/i.test(said))
    return fail(noProject ? NO_PROJECT : NO_ANSWER)
  }
  if (ran.truncated) return fail(NO_ANSWER)
  try {
    return { ok: true, json: JSON.parse(ran.stdout) }
  } catch {
    return fail(NO_ANSWER)
  }
}

// A bd list answer: an array of beads, or undefined when it is not one.
export const asBeads = (json: unknown): Bead[] | undefined =>
  Array.isArray(json) && json.every(row => typeof row === 'object' && row !== null && typeof (row as Bead).id === 'string')
    ? (json as Bead[])
    : undefined

// Titles are free text: one line, cut to `max`.
export const clip = (text: string | undefined, max: number): string => {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

// Priority 0 first, then oldest first.
export const byPriorityThenAge = (a: Bead, b: Bead): number =>
  (a.priority ?? 9) - (b.priority ?? 9) || (a.created_at ?? '').localeCompare(b.created_at ?? '')

// `bm-ooq.64  P1  title`
export const row = (b: Bead): string => `${b.id}  P${b.priority ?? '?'}  ${clip(b.title, 80)}`

// Local midnight at the start of yesterday, as an exact instant (RFC3339, UTC).
export const yesterdayStart = (now: Date): string =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
