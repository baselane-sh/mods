import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { FileTouch, PaneView, TurnCost } from '../../types'
import { failedTurn, noRun } from '../engine'
import type { Live, Panes } from '../engine'
import type { PaneRule } from '../rule'
import { endTurn, startTurn } from '../turns'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it.
const views = atom({ plugin: 'pane-mods', key: 'views' } as const, {})
const turns = atom({ plugin: 'pane-mods', key: 'turns' } as const, [] as TurnCost[])
const files = atom({ plugin: 'pane-mods', key: 'files' } as const, [] as FileTouch[])

// For rules with `turns`: each turn's cost, and a load after each turn. Only
// the main loop raises turn.start, so a subagent's run is never a turn.
export const measureTurns = (on: On, rules: readonly PaneRule[], panes: Panes): void => {
  const turnRules = rules.filter(rule => rule.turns === true)

  on('turn.start', async ($, e, next) => {
    try {
      const usd = (await $.session.usage()).cost?.usd
      const at = await $.clock.now()
      await update($, turns, ledger => startTurn(ledger, e.turnId, usd, at))
    } catch (error) {
      await $.ui.log(failedTurn('start', error))
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
          run: noRun,
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
      for (const rule of turnRules) void panes.request(rule, live)
    } catch (error) {
      await $.ui.log(failedTurn('end', error))
    }
    return next(e)
  })
}
