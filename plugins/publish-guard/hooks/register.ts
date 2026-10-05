import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as publish } from './rules/publish'

export const register: Register = on => {
  const rules = [publish]
  checkCalls(on, rules)
}
