import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as deploy } from './rules/deploy'

export const register: Register = on => {
  const rules = [deploy]
  checkCalls(on, rules)
}
