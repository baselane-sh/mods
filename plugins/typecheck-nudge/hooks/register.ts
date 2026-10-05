import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as typecheckNudge } from './rules/typecheck-nudge'

export const register: Register = on => {
  const rules = [typecheckNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
