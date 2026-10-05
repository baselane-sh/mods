import type { On } from 'claude-code'

import { START_RUN_TIMEOUT_MS, sessionStart } from '../engine'
import type { LifecycleRule, StartTools } from '../engine'

// As the session starts, for rules that run a program and show a toast. Not
// awaited: the session does not wait on a program.
export const startSessionWithRun = (on: On, rules: readonly LifecycleRule[]): void => {
  on('session.start', async ($, e, next) => {
    const tools: StartTools = {
      run: (argv, cwd) => $.process.run(argv, { cwd, timeoutMs: START_RUN_TIMEOUT_MS }),
      toast: text => $.ui.toast(text),
    }
    void sessionStart(rules, tools, text => $.ui.log(text), { cwd: e.cwd })
    return next(e)
  })
}
