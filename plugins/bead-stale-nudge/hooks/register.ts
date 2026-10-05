import type { Register } from 'claude-code'

import { startSessionWithRun } from './hosts/start-run'
import { rule as beadStaleNudge } from './rules/bead-stale-nudge'

export const register: Register = on => {
  const rules = [beadStaleNudge]
  startSessionWithRun(on, rules)
}
