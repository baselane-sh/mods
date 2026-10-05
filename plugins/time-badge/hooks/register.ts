import type { Register } from 'claude-code'

import { keepDurations } from './hosts/timer'
import { drawToolRowsWithDurations } from './hosts/row-timed'
import { create as timeBadge } from './rules/time-badge'

export const register: Register = on => {
  const rules = [timeBadge()]
  keepDurations(on, rules)
  drawToolRowsWithDurations(on, rules)
}
