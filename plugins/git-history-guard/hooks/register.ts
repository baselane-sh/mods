import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as gitHistory } from './rules/git-history'

export const register: Register = on => {
  const rules = [gitHistory]
  checkCalls(on, rules)
}
