import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as migrationNudge } from './rules/migration-nudge'

export const register: Register = on => {
  const rules = [migrationNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
