import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindWithUsage } from './hosts/stop-usage'
import { create as testReminder } from './rules/test-reminder'
import { create as ctxNudge } from './rules/ctx-nudge'

export const register: Register = on => {
  const rules = [testReminder(), ctxNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindWithUsage(on, rules)
}
