import type { Register } from 'claude-code'

import { checkCallsWithRun } from './hosts/check-run'
import { rule as tag } from './rules/tag'

export const register: Register = on => {
  const rules = [tag]
  checkCallsWithRun(on, rules)
}
