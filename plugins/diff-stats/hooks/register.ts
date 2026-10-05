import type { Register } from 'claude-code'

import { drawToolRows } from './hosts/row'
import { create as diffStats } from './rules/diff-stats'

export const register: Register = on => {
  const rules = [diffStats()]
  drawToolRows(on, rules)
}
