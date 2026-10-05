import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as bigDiffNudge } from './rules/big-diff-nudge'

export const register: Register = on => {
  const rules = [bigDiffNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
