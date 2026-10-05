import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as commitNudge } from './rules/commit-nudge'

export const register: Register = on => {
  const rules = [commitNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
