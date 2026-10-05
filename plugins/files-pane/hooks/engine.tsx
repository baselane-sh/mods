import { atom, read } from 'claude-code'
import type { On, Timer, ToolCallEnvelope, ToolCallResult } from 'claude-code'

import type { PaneLine, PaneView } from '../types'
import { touchOf } from './files'
import type { FileAction } from './files'
import { line, redactLines } from './lines'
import type { PaneHost, PaneRule } from './rule'
import { paneTree } from './view'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it.
const views = atom({ plugin: 'files-pane', key: 'views' } as const, {})

// A pane reads the world at most once a second, however many calls ask.
const MIN_GAP_MS = 1_000

// How long a load asked for at `now` must wait, given the last one began at
// `last`: nothing, or the rest of the second since it.
export const waitBeforeLoad = (last: number | undefined, now: number): number =>
  last === undefined ? 0 : Math.max(0, MIN_GAP_MS - (now - last))

// What the engine's loads need from `$`, as closures built in a hook. A timer
// keeps them past the hook's dispatch, as `$.clock.every` documents.
export type Live = {
  host: PaneHost
  now: () => Promise<number>
  isOpen: (id: string) => Promise<boolean>
  write: (id: string, view: PaneView) => Promise<unknown>
  log: (text: string) => unknown
  after: (ms: number, fn: () => void) => Timer
  every: (ms: number, fn: () => void) => Timer
}

// The pane loads every hook shares: one throttle and one timer per pane.
export type Panes = {
  request: (rule: PaneRule, live: Live) => Promise<void>
  stop: (id: string) => void
}

export const RUN_TIMEOUT_MS = 10_000

// A host that does not give `run`. A rule that calls it shows the failure in
// its pane, and its tests fail: name it in engine.json `needs`.
export const noRun = (): Promise<never> => Promise.reject(new Error('run is not given to this mod; name it in engine.json needs'))

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const failedLines = (error: unknown): PaneLine[] => [line('failed', { text: `Could not read: ${message(error)}`, color: 'red' })]

// The loads every hook of the mod shares. Made once per load of the module,
// by register.ts (engine.json shared).
export const createPanes = (): Panes => {
  // Timers and load times by pane id. Not drawn, so not kept in $.state; a
  // hot reload drops them with the module, and the next load starts again.
  const pollers = new Map<string, Timer>()
  const trailing = new Map<string, Timer>()
  const loadedAt = new Map<string, number>()

  const stop = (id: string): void => {
    pollers.get(id)?.cancel()
    pollers.delete(id)
    trailing.get(id)?.cancel()
    trailing.delete(id)
  }

  // A closed pane stops its timer here too: the person's close may come
  // when no hook of this module hears it.
  const load = async (rule: PaneRule, live: Live): Promise<void> => {
    const id = rule.pane.id
    if (rule.load === undefined) return
    if (!(await live.isOpen(id))) {
      stop(id)
      return
    }
    if (rule.everyMs !== undefined && !pollers.has(id)) {
      pollers.set(id, live.every(rule.everyMs, () => void request(rule, live)))
    }
    let lines: PaneLine[]
    try {
      lines = await rule.load(live.host)
    } catch (error) {
      lines = failedLines(error)
      await live.log(`${rule.id}: the pane could not read, ${message(error)}`)
    }
    await live.write(id, { at: await live.now(), lines: redactLines(lines) })
  }

  // Loads now, or once the second since the last load is out. A burst of
  // asks inside that second ends in one load.
  const request = async (rule: PaneRule, live: Live): Promise<void> => {
    const id = rule.pane.id
    if (trailing.has(id)) return
    const now = await live.now()
    const wait = waitBeforeLoad(loadedAt.get(id), now)
    if (wait > 0) {
      trailing.set(
        id,
        live.after(wait, () => {
          trailing.delete(id)
          void request(rule, live)
        }),
      )
      return
    }
    loadedAt.set(id, now)
    await load(rule, live)
  }

  return { request, stop }
}

// The hooks every pane mod has. The slash command, the tool call and the turn
// hooks build the closures a load needs, so they are hosts (engine.json).
export const registerPanes = (on: On, rules: readonly PaneRule[], panes: Panes): void => {
  on('session.start', async ($, e, next) => {
    for (const rule of rules) {
      await $.command.register({ name: rule.pane.command, description: rule.pane.description, immediate: true })
    }
    return next(e)
  })

  for (const rule of rules) {
    const { id } = rule.pane

    // Must pass the close on: answering without `next` keeps the pane open.
    on('ui.close', { id }, async ($, e, next) => {
      panes.stop(id)
      return next(e)
    })

    on('ui.render', { component: 'Pane', requestId: id }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      const all: Readonly<Record<string, PaneView>> = await read($, views)
      return paneTree({ Box, Text }, rule.pane, all[id], e.props.bodyColumns)
    })
  }
}

// The slash command: opens the pane and loads it, or closes an open one.
export const togglePane = async (
  rule: PaneRule,
  panes: Panes,
  live: Live,
  ui: { open: () => Promise<unknown>; close: () => Promise<unknown> },
): Promise<{ text: string }> => {
  const { id, title, command } = rule.pane
  if (await live.isOpen(id)) {
    panes.stop(id)
    await ui.close()
    return { text: `${title} pane closed.` }
  }
  await ui.open()
  await panes.request(rule, live)
  return { text: `${title} pane opened. Run /${command} again or press Esc to close it.` }
}

// What a finished tool call writes, as closures over the hook's `$`.
export type CallWrites = {
  now: () => Promise<number>
  countTurn: () => Promise<unknown>
  touch: (path: string, action: FileAction, at: number) => Promise<unknown>
  show: (id: string, view: PaneView) => Promise<unknown>
  live: () => Live
  log: (text: string) => unknown
}

// After each tool call: the turn and file ledgers, each watching rule's new
// lines, then a load of each pane the call is due to refresh.
export const afterToolCall = async (
  rules: readonly PaneRule[],
  panes: Panes,
  e: ToolCallEnvelope,
  next: (e: ToolCallEnvelope) => Promise<ToolCallResult>,
  writes: CallWrites,
): Promise<ToolCallResult> => {
  const watchers = rules.filter(rule => rule.observe !== undefined)
  const counts = rules.some(rule => rule.turns === true)
  const keepsFiles = rules.some(rule => rule.files === true)
  const startedAt = watchers.length > 0 ? await writes.now() : 0
  const ran = await next(e)
  try {
    // Before any refresh below, so a load reads this call too.
    if (counts) await writes.countTurn()
    const touch = keepsFiles ? touchOf(e, ran) : undefined
    if (touch !== undefined) await writes.touch(touch.path, touch.action, await writes.now())
    if (watchers.length > 0) {
      const at = await writes.now()
      for (const rule of watchers) {
        let lines: PaneLine[] | undefined
        try {
          lines = rule.observe?.({ e, ran, durationMs: at - startedAt })
        } catch (error) {
          lines = failedLines(error)
        }
        if (lines !== undefined) await writes.show(rule.pane.id, { at, lines: redactLines(lines) })
      }
    }
    const due = rules.filter(rule => rule.load !== undefined && rule.refreshAfter?.(e) === true)
    if (due.length > 0) {
      const live = writes.live()
      // Not awaited: the tool's result does not wait on a pane's refresh.
      for (const rule of due) void panes.request(rule, live)
    }
  } catch (error) {
    await writes.log(`pane: a tool call was not read, ${message(error)}`)
  }
  return ran
}

export const failedTurn = (where: string, error: unknown): string => `pane: a turn ${where} was not read, ${message(error)}`
