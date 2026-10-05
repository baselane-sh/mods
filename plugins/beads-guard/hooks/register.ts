import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as beads } from './rules/beads'

export const register: Register = on => {
  const rules = [beads]
  checkCalls(on, rules)
}
