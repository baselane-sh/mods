import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as docsNudge } from './rules/docs-nudge'

export const register: Register = on => {
  const rules = [docsNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
