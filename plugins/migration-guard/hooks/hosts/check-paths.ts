import type { On } from 'claude-code'

import { evaluate, NO_TOOLS } from '../engine'
import type { GuardRule, GuardTools } from '../engine'

// The check for rules that also read where a path really lands.
export const checkCallsWithPaths = (on: On, rules: readonly GuardRule[]): void => {
  on('classic.PreToolUse', async ($, e, next) => {
    const tools: GuardTools = {
      ...NO_TOOLS,
      cwd: () => $.session.cwd(),
      realPath: path => $.fs.stat(path, { resolve: true }).then(stat => stat.realPath, () => undefined),
    }
    return (await evaluate(rules, e, tools)) ?? next(e)
  })
}
