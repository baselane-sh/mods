import type { Register } from 'claude-code'

import { checkCallsWithAll } from './hosts/check-all'
import { rule as ssh } from './rules/ssh'

export const register: Register = on => {
  const rules = [ssh]
  checkCallsWithAll(on, rules)
}
