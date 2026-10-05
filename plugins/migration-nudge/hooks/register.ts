import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as migrationNudge } from './rules/migration-nudge'

export const register: Register = on => {
  const rules = [migrationNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
