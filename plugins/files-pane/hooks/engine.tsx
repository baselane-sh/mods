import { atom, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { FileTouch, PaneLine, PaneView, TurnCost } from '../types'
import { touchFile, touchOf } from './files'
import { line, redactLines } from './lines'
import type { PaneHost, PaneRule } from './rule'
import { countTool, endTurn, startTurn } from './turns'
import { paneTree } from './view'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it.
const views = atom({ plugin: 'files-pane', key: 'views' } as const, {})
const turns = atom({ plugin: 'files-pane', key: 'turns' } as const, [] as TurnCost[])
const files = atom({ plugin: 'files-pane', key: 'files' } as const, [] as FileTouch[])

// A pane reads the world at most once a second, however many calls ask.
const MIN_GAP_MS = 1_000
const RUN_TIMEOUT_MS = 10_000

// How long a load asked for at `now` must wait, given the last one began at
// `last`: nothing, or the rest of the second since it.
export const waitBeforeLoad = (last: number | undefined, now: number): number =>
  last === undefined ? 0 : Math.max(0, MIN_GAP_MS - (now - last))

// What the engine's loads need from `$`, as closures built in a hook. A timer
// keeps them past the hook's dispatch, as `$.clock.every` documents.
type Live = {
  host: PaneHost
  now: () => Promise<number>
  isOpen: (id: string) => Promise<boolean>
  write: (id: string, view: PaneView) => Promise<unknown>
  log: (text: string) => unknown
  after: (ms: number, fn: () => void) => Timer
  every: (ms: number, fn: () => void) => Timer
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const failedLines = (error: unknown): PaneLine[] => [line('failed', { text: `Could not read: ${message(error)}`, color: 'red' })]

export const registerPanes = (on: On, rules: readonly PaneRule[]): void => {
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

  on('session.start', async ($, e, next) => {
    for (const rule of rules) {
      await $.command.register({ name: rule.pane.command, description: rule.pane.description, immediate: true })
    }
    return next(e)
  })

  for (const rule of rules) {
    const { id, title, command } = rule.pane

    on('command.run', { command }, async $ => {
      const live: Live = {
        host: {
          run: argv => $.process.run(argv, { timeoutMs: RUN_TIMEOUT_MS }),
          cwd: () => $.session.cwd(),
          usage: () => $.session.usage(),
          turns: () => read($, turns),
          files: () => read($, files),
        },
        now: () => $.clock.now(),
        isOpen: async pane => (await $.ui.panes()).some(open => open.id === pane),
        write: (pane, view) => update($, views, all => ({ ...all, [pane]: view })),
        log: text => $.ui.log(text),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
      }
      if (await live.isOpen(id)) {
        stop(id)
        await $.ui.close({ id })
        return { text: `${title} pane closed.` }
      }
      await $.ui.open({ id, title, closeOnEscape: true })
      await request(rule, live)
      return { text: `${title} pane opened. Run /${command} again or press Esc to close it.` }
    })

    // Must pass the close on: answering without `next` keeps the pane open.
    on('ui.close', { id }, async ($, e, next) => {
      stop(id)
      return next(e)
    })

    on('ui.render', { component: 'Pane', requestId: id }, async ($, e) => {
      const { Box, Text } = $.ui.resolve(e)
      const all: Readonly<Record<string, PaneView>> = await read($, views)
      return paneTree({ Box, Text }, rule.pane, all[id], e.props.bodyColumns)
    })
  }

  const watchers = rules.filter(rule => rule.observe !== undefined)
  const turnRules = rules.filter(rule => rule.turns === true)
  const keepsFiles = rules.some(rule => rule.files === true)

  on('tool.call', async ($, e, next) => {
    const startedAt = watchers.length > 0 ? await $.clock.now() : 0
    const ran = await next(e)
    try {
      // Before any refresh below, so a load reads this call too.
      if (turnRules.length > 0) await update($, turns, countTool)
      const touch = keepsFiles ? touchOf(e, ran) : undefined
      if (touch !== undefined) {
        const at = await $.clock.now()
        await update($, files, ledger => touchFile(ledger, touch.path, touch.action, at))
      }
      if (watchers.length > 0) {
        const at = await $.clock.now()
        for (const rule of watchers) {
          let lines: PaneLine[] | undefined
          try {
            lines = rule.observe?.({ e, ran, durationMs: at - startedAt })
          } catch (error) {
            lines = failedLines(error)
          }
          if (lines !== undefined) {
            const view: PaneView = { at, lines: redactLines(lines) }
            await update($, views, all => ({ ...all, [rule.pane.id]: view }))
          }
        }
      }
      const due = rules.filter(rule => rule.load !== undefined && rule.refreshAfter?.(e) === true)
      if (due.length > 0) {
        const live: Live = {
          host: {
          run: argv => $.process.run(argv, { timeoutMs: RUN_TIMEOUT_MS }),
          cwd: () => $.session.cwd(),
          usage: () => $.session.usage(),
          turns: () => read($, turns),
          files: () => read($, files),
        },
          now: () => $.clock.now(),
          isOpen: async pane => (await $.ui.panes()).some(open => open.id === pane),
          write: (pane, view) => update($, views, all => ({ ...all, [pane]: view })),
          log: text => $.ui.log(text),
          after: (ms, fn) => $.clock.after(ms, fn),
          every: (ms, fn) => $.clock.every(ms, fn),
        }
        // Not awaited: the tool's result does not wait on a pane's refresh.
        for (const rule of due) void request(rule, live)
      }
    } catch (error) {
      await $.ui.log(`pane: a tool call was not read, ${message(error)}`)
    }
    return ran
  })

  // A mod with no rule that asks for turns hooks none.
  if (turnRules.length === 0) return

  // Only the main loop raises turn.start, so a subagent's run is never a turn.
  on('turn.start', async ($, e, next) => {
    try {
      const usd = (await $.session.usage()).cost?.usd
      const at = await $.clock.now()
      await update($, turns, ledger => startTurn(ledger, e.turnId, usd, at))
    } catch (error) {
      await $.ui.log(`pane: a turn start was not read, ${message(error)}`)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    try {
      const usd = (await $.session.usage()).cost?.usd
      const at = await $.clock.now()
      await update($, turns, ledger => endTurn(ledger, e.turnId, usd, at))
      const live: Live = {
        host: {
          run: argv => $.process.run(argv, { timeoutMs: RUN_TIMEOUT_MS }),
          cwd: () => $.session.cwd(),
          usage: () => $.session.usage(),
          turns: () => read($, turns),
          files: () => read($, files),
        },
        now: () => $.clock.now(),
        isOpen: async pane => (await $.ui.panes()).some(open => open.id === pane),
        write: (pane, view) => update($, views, all => ({ ...all, [pane]: view })),
        log: text => $.ui.log(text),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
      }
      // Not awaited, as after a tool call: the turn does not wait on a pane.
      for (const rule of turnRules) void request(rule, live)
    } catch (error) {
      await $.ui.log(`pane: a turn end was not read, ${message(error)}`)
    }
    return next(e)
  })
}
