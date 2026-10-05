import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { FileTouch, PaneView, TurnCost } from '../../types'
import { afterToolCall, noRun, togglePane } from '../engine'
import type { Live, Panes } from '../engine'
import { touchFile } from '../files'
import type { PaneRule } from '../rule'
import { countTool } from '../turns'

// The build writes the mod's own name in place of the token: `$.state` is
// written only by the plugin that owns it.
const views = atom({ plugin: 'files-pane', key: 'views' } as const, {})
const turns = atom({ plugin: 'files-pane', key: 'turns' } as const, [] as TurnCost[])
const files = atom({ plugin: 'files-pane', key: 'files' } as const, [] as FileTouch[])

// The closures a load needs. Declared in this file, so the host follows `$`
// into it; a timer keeps them past the hook's dispatch.
const liveOf = ($: EngineInterface): Live => ({
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
})

// The pane's slash command and tool calls, for rules that read without running a program.
export const openPanes = (on: On, rules: readonly PaneRule[], panes: Panes): void => {
  for (const rule of rules) {
    const { id, title } = rule.pane
    on('command.run', { command: rule.pane.command }, async $ =>
      togglePane(rule, panes, liveOf($), {
        open: () => $.ui.open({ id, title, closeOnEscape: true }),
        close: () => $.ui.close({ id }),
      }),
    )
  }

  on('tool.call', async ($, e, next) =>
    afterToolCall(rules, panes, e, next, {
      now: () => $.clock.now(),
      countTurn: () => update($, turns, countTool),
      touch: (path, action, at) => update($, files, ledger => touchFile(ledger, path, action, at)),
      show: (pane, view) => update($, views, all => ({ ...all, [pane]: view })),
      live: () => liveOf($),
      log: text => $.ui.log(text),
    }),
  )
}
