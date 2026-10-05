import type { On } from 'claude-code'

import { evaluate, NO_TOOLS, RUN_TIMEOUT_MS } from '../engine'
import type { GuardRule, GuardTools } from '../engine'

// The check for rules that also run a host command (git, for the rules that
// inspect the repo).
export const checkCallsWithRun = (on: On, rules: readonly GuardRule[]): void => {
  on('classic.PreToolUse', async ($, e, next) => {
    const tools: GuardTools = {
      ...NO_TOOLS,
      cwd: () => $.session.cwd(),
      run: (argv, cwd) => $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS }),
    }
    return (await evaluate(rules, e, tools)) ?? next(e)
  })
}
