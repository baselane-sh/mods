import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { remindWithUsage } from './hosts/stop-usage'
import { create as ctxNudge } from './rules/ctx-nudge'

export const register: Register = on => {
  const rules = [ctxNudge()]
  const shared = createNotes()
  remindWithUsage(on, rules)
}
