import type { Register } from 'claude-code'

import { drawToolRows } from './hosts/row'
import { create as sizeBadge } from './rules/size-badge'

export const register: Register = on => {
  const rules = [sizeBadge()]
  drawToolRows(on, rules)
}
