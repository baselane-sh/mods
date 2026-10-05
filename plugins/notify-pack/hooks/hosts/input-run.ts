import type { On, PluginOptions } from 'claude-code'

import { needsInput, NO_NOTIFY_TOOLS, NOTIFY_TIMEOUT_MS, settingsFrom } from '../engine'
import type { LifecycleRule, NotifyTools } from '../engine'

// When Claude Code waits for the person, for rules that run a program (a
// desktop notification).
export const needsInputWithRun = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('classic.Notification', async ($, e, next) => {
    const tools: NotifyTools = { ...NO_NOTIFY_TOOLS, run: argv => $.process.run(argv, { timeoutMs: NOTIFY_TIMEOUT_MS }) }
    await needsInput(rules, settings, tools, text => $.ui.log(text), e)
    return next(e)
  })
}
