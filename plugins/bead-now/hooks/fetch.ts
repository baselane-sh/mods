import type { ProcessRunResult } from 'claude-code'

import type { Fetched, GitState } from '../types'
import type { BandRule, EditCall, Fetcher } from './rule'

// What a run needs, as closures over `$`: `$` itself is never passed on.
export type FetchDeps = {
  now: () => Promise<number>
  run: (argv: readonly string[], timeoutMs: number) => Promise<ProcessRunResult>
  git: () => Promise<GitState | null>
  // Stores the figure; answers whether it changed what was drawn.
  set: (id: string, value: Fetched | null) => Promise<boolean>
  log: (text: string) => unknown
}

export type FetchWhy = 'time' | 'edit'

// Run bookkeeping, not drawn state: when each rule last started, which are
// running, and which were asked again while running. A hot reload resets it.
const startedAt = new Map<string, number>()
const running = new Set<string>()
// The call and generation behind each edit asked for again.
const again = new Map<string, { call: EditCall | undefined; generation: number }>()
// Edit triggers so far. A run reads under the generation it started in; runs
// of one generation may share a read, and none shares one from before an edit.
let edits = 0

// An edit run is asked for by any file-touching call, or only by the calls a
// rule's `onEditWhen` picks.
const isAsked = (fetch: Fetcher, why: FetchWhy, call: EditCall | undefined): boolean =>
  why === 'edit'
    ? fetch.onEdit === true && (fetch.onEditWhen === undefined || (call !== undefined && fetch.onEditWhen(call)))
    : fetch.everyMs !== undefined

// A rate equal to the minute tick would skip every other tick when the last
// run started a few ms after its own: a run this close to its rate is due.
const RATE_SLACK_MS = 1000

const isTooSoon = (fetch: Fetcher, last: number | undefined, now: number): boolean =>
  last !== undefined && fetch.everyMs !== undefined && now - last < fetch.everyMs - RATE_SLACK_MS

const runOne = async (
  id: string,
  fetch: Fetcher,
  why: FetchWhy,
  deps: FetchDeps,
  generation: number,
  call?: EditCall,
): Promise<void> => {
  if (!isAsked(fetch, why, call)) return
  if (running.has(id)) {
    // A file edit during a run may not be in its answer: run once more after it.
    if (why === 'edit') again.set(id, { call, generation })
    return
  }
  // Marked running before the first await, so two triggers at once start one
  // run; the finally clears it, and runs an edit that came meanwhile.
  running.add(id)
  const last = startedAt.get(id)
  try {
    const now = await deps.now()
    if (why === 'time') {
      if (isTooSoon(fetch, last, now)) return
      startedAt.set(id, now)
    }
    const value = await fetch.read(argv => deps.run(argv, fetch.timeoutMs), await deps.git(), now, generation)
    if (value === undefined) {
      // Nothing to ask yet: the run does not count against the rate.
      if (why === 'time') last === undefined ? startedAt.delete(id) : startedAt.set(id, last)
    } else {
      await deps.set(id, value)
    }
  } catch (error) {
    // A figure that could not be read again is dropped: a stale one misleads.
    const isChange = await deps.set(id, null)
    if (isChange) await deps.log(`band: ${id} skipped, ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    running.delete(id)
    const asked = again.get(id)
    if (asked !== undefined) {
      again.delete(id)
      void runOne(id, fetch, 'edit', deps, asked.generation, asked.call).catch(() => undefined)
    }
  }
}

// Starts the runs that are due for `why`. Not awaited by a tool call or a
// turn end: each run is bounded by its own timeout. `call` is the tool call
// behind an edit run.
export const runFetchers = async (rules: readonly BandRule[], why: FetchWhy, deps: FetchDeps, call?: EditCall): Promise<void> => {
  if (why === 'edit') edits += 1
  const generation = edits
  await Promise.all(
    rules.map(rule =>
      rule.fetch === undefined
        ? undefined
        : runOne(rule.id, rule.fetch, why, deps, generation, call).catch(error => deps.log(`band: ${rule.id} skipped, ${String(error)}`)),
    ),
  )
}

type Figures = Readonly<Record<string, Fetched | null>>

const isSame = (a: Fetched | null | undefined, b: Fetched | null): boolean =>
  (a ?? null) === b || (a != null && b !== null && a.text === b.text && a.color === b.color && a.tag === b.tag)

// Keeps one rule's figure in the atom, whole-map replaced, and answers whether
// it differed. `write` is the caller's `update($, fetched, fn)`.
export const storeFetched = async (
  write: (change: (current: Figures) => Figures) => Promise<unknown>,
  id: string,
  value: Fetched | null,
): Promise<boolean> => {
  let isChange = false
  await write(current => {
    isChange = !isSame(current[id], value)
    return isChange ? { ...current, [id]: value } : current
  })
  return isChange
}

export const hasFetchers = (rules: readonly BandRule[]): boolean => rules.some(rule => rule.fetch !== undefined)
