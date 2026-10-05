import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { notePrompts } from './hosts/prompt-notes'
import { remindWithRun } from './hosts/stop-run'
import { create as beadCommitNudge } from './rules/bead-commit-nudge'

export const register: Register = on => {
  const rules = [beadCommitNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  notePrompts(on, rules, shared)
  remindWithRun(on, rules, shared)
}
