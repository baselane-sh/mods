import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindWithEnvNames } from './hosts/stop-env'
import { create as envExampleNudge } from './rules/env-example-nudge'

export const register: Register = on => {
  const rules = [envExampleNudge()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindWithEnvNames(on, rules)
}
