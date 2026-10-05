import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as clippy } from './rules/clippy'

export const register: Register = on => {
  const rules = [clippy()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
