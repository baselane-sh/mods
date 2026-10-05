import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as noVerify } from './rules/no-verify'

export const register: Register = on => {
  const rules = [noVerify]
  checkCalls(on, rules)
}
