import type { Register } from 'claude-code'

import { drawToolRows } from './hosts/row'
import { create as exitBadge } from './rules/exit-badge'

export const register: Register = on => {
  const rules = [exitBadge()]
  drawToolRows(on, rules)
}
