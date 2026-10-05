import type { Register } from 'claude-code'

import { addLiveSections } from './hosts/live'
import { rule as beadsPrime } from './rules/beads-prime'

export const register: Register = on => {
  const rules = [beadsPrime]
  addLiveSections(on, rules)
}
