import type { Register } from 'claude-code'

import { keepDurations } from './hosts/timer'
import { drawToolRowsWithDurations } from './hosts/row-timed'
import { create as timeBadge } from './rules/time-badge'
import { create as exitBadge } from './rules/exit-badge'
import { create as sizeBadge } from './rules/size-badge'

export const register: Register = on => {
  const rules = [timeBadge(), exitBadge(), sizeBadge()]
  keepDurations(on, rules)
  drawToolRowsWithDurations(on, rules)
}
