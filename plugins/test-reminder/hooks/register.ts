import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as testReminder } from './rules/test-reminder'

export const register: Register = on => {
  const rules = [testReminder()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
