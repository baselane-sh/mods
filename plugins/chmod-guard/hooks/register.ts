import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as chmod } from './rules/chmod'

export const register: Register = on => {
  const rules = [chmod]
  checkCalls(on, rules)
}
