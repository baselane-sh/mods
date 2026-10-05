import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as dbReset } from './rules/db-reset'

export const register: Register = on => {
  const rules = [dbReset]
  checkCalls(on, rules)
}
