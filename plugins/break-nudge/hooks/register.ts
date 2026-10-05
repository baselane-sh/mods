import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { remindWithUsageAndClock } from './hosts/stop-usage-clock'
import { create as breakNudge } from './rules/break-nudge'

export const register: Register = on => {
  const rules = [breakNudge()]
  const shared = createNotes()
  remindWithUsageAndClock(on, rules)
}
