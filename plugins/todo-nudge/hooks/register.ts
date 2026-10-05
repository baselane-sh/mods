import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as todoNudge } from './rules/todo-nudge'

export const register: Register = on => {
  const rules = [todoNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
