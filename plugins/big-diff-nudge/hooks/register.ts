import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as bigDiffNudge } from './rules/big-diff-nudge'

export const register: Register = on => {
  const rules = [bigDiffNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
