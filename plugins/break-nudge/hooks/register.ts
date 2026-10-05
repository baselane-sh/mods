import type { Register } from 'claude-code'

import { remindWithUsageAndClock } from './hosts/stop-usage-clock'
import { create as breakNudge } from './rules/break-nudge'

export const register: Register = on => {
  const rules = [breakNudge()]
  remindWithUsageAndClock(on, rules)
}
