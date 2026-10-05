import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as upload } from './rules/upload'

export const register: Register = on => {
  const rules = [upload]
  checkCalls(on, rules)
}
