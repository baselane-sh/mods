import type { On } from 'claude-code'

import { evaluate, NO_TOOLS } from '../engine'
import type { GuardRule } from '../engine'

// The check for rules that read only the call itself: no `$` call at all.
export const checkCalls = (on: On, rules: readonly GuardRule[]): void => {
  on('classic.PreToolUse', async (_$, e, next) => (await evaluate(rules, e, NO_TOOLS)) ?? next(e))
}
