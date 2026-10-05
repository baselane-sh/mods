import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as prodDb } from './rules/prod-db'

export const register: Register = on => {
  const rules = [prodDb]
  checkCalls(on, rules)
}
