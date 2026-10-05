import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as testReminder } from './rules/test-reminder'

export const register: Register = on => {
  const rules = [testReminder()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
