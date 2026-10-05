import type { On } from 'claude-code'

import { evaluate, RUN_TIMEOUT_MS } from '../engine'
import type { GuardRule, GuardTools } from '../engine'

// The check for a mod whose rules read paths and run host commands.
export const checkCallsWithAll = (on: On, rules: readonly GuardRule[]): void => {
  on('classic.PreToolUse', async ($, e, next) => {
    const tools: GuardTools = {
      cwd: () => $.session.cwd(),
      realPath: path => $.fs.stat(path, { resolve: true }).then(stat => stat.realPath, () => undefined),
      run: (argv, cwd) => $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS }),
    }
    return (await evaluate(rules, e, tools)) ?? next(e)
  })
}
