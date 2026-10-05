import type { Register } from 'claude-code'

import { turnEndWithRun } from './hosts/turn-run'
import { rule as sayDone } from './rules/say-done'

export const register: Register = (on, options) => {
  const rules = [sayDone]
  turnEndWithRun(on, rules, options)
}
