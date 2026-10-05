import type { On, PluginOptions } from 'claude-code'

import { NOTIFY_TIMEOUT_MS, settingsFrom, turnEnd } from '../engine'
import type { LifecycleRule, RunTools, TurnEnd } from '../engine'

// At a main-loop turn's end, for rules that run a program. A subagent's turn
// is not the person's turn. The answer is shown first.
export const turnEndWithRun = (on: On, rules: readonly LifecycleRule[], options: PluginOptions): void => {
  const settings = settingsFrom(options)
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done
    const tools: RunTools = { run: argv => $.process.run(argv, { timeoutMs: NOTIFY_TIMEOUT_MS }) }
    const end: TurnEnd = { cwd: await $.session.cwd(), durationMs: e.durationMs, isAborted: e.isAborted }
    await turnEnd(rules, settings, tools, text => $.ui.log(text), end)
    return done
  })
}
