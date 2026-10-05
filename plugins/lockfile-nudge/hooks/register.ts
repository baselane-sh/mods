import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as lockfileNudge } from './rules/lockfile-nudge'

export const register: Register = on => {
  const rules = [lockfileNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
