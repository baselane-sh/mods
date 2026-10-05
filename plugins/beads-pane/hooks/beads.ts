import type { ProcessRunResult, ToolCallEnvelope } from 'claude-code'

import type { PaneLine } from '../types'
import { RUN_TIMEOUT_MS } from './engine'
import { line } from './lines'
import type { PaneHost } from './rule'

// What the beads panes share: one read-only bd call, its failures as one line,
// and the issue fields they draw. Only read commands with --json run here;
// --readonly has bd itself refuse a write.

// bd reads an embedded database: at most one load every 10 seconds.
export const BD_GAP_MS = 10_000

export const NO_PROJECT = 'No beads project in this folder.'
export const NOT_INSTALLED = 'bd is not installed.'
export const NO_ANSWER = 'bd did not answer.'

// bd says this on stderr, exit 1, where no `.beads` is in the folder or above it.
const NO_PROJECT_TEXT = /no beads (database|project) found/i
// `$.process.run` rejects when bd cannot start (not installed) and when it
// runs past the timeout (no answer). The message is the host's own wording,
// so a reject that came near the timeout counts as one too.
const TIMED_OUT = /time(d)?[ -]?out|still running|killed/i
const NEAR_TIMEOUT_MS = RUN_TIMEOUT_MS - 1_000

export const rejectText = (message: string, elapsedMs: number): string =>
  TIMED_OUT.test(message) || elapsedMs >= NEAR_TIMEOUT_MS ? NO_ANSWER : NOT_INSTALLED

export type BdRead = { ok: true; value: unknown } | { ok: false; lines: PaneLine[] }

const failed = (text: string): BdRead => ({ ok: false, lines: [line('bd-failed', { text, dim: true })] })

export const bdArgv = (cwd: string, args: readonly string[]): string[] => ['bd', '-C', cwd, '--readonly', ...args, '--json']

export const refreshAfterBash = (e: ToolCallEnvelope): boolean => e.tool === 'Bash'

// Runs one bd read in `cwd` and parses its JSON. Whatever goes wrong is one
// line for the pane; bd's own error text is never shown.
export const readBd = async (host: PaneHost, cwd: string, args: readonly string[]): Promise<BdRead> => {
  let ran: ProcessRunResult
  // Wall time, not the session clock: only the gap matters, and a mocked clock does not move while bd runs.
  const startedAt = Date.now()
  try {
    ran = await host.run(bdArgv(cwd, args))
  } catch (error) {
    return failed(rejectText(error instanceof Error ? error.message : String(error), Date.now() - startedAt))
  }
  if (ran.exitCode !== 0) return failed(NO_PROJECT_TEXT.test(ran.stderr) ? NO_PROJECT : NO_ANSWER)
  // A cut output would not parse, or worse, parse short.
  if (ran.isStdoutTruncated) return failed(NO_ANSWER)
  try {
    return { ok: true, value: JSON.parse(ran.stdout) as unknown }
  } catch {
    return failed(NO_ANSWER)
  }
}

export type Bead = { id: string; title: string; priority: number; createdAt: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// One issue of `bd list`, `bd ready` or `bd blocked`, or undefined for an
// entry without an id, a title or a priority.
export const beadOf = (value: unknown): Bead | undefined => {
  if (!isRecord(value)) return undefined
  const { id, title, priority, created_at: createdAt } = value
  if (typeof id !== 'string' || id.length === 0 || typeof title !== 'string') return undefined
  if (typeof priority !== 'number' || !Number.isInteger(priority)) return undefined
  return { id, title, priority, createdAt: typeof createdAt === 'string' ? createdAt : '' }
}

// A list of issues, or undefined when the JSON is not one. bd may print null
// for none.
export const beadsOf = (value: unknown): Bead[] | undefined => {
  if (value === null) return []
  if (!Array.isArray(value)) return undefined
  return value.flatMap(each => {
    const bead = beadOf(each)
    return bead === undefined ? [] : [bead]
  })
}

// Priority first (0 is the highest), then the oldest created, then the id.
export const byPriority = (a: Bead, b: Bead): number =>
  a.priority - b.priority || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

export const PRIORITY_COLORS: Readonly<Record<number, string>> = { 0: 'red', 1: 'yellow' }
