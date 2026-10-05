import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as debugPrintNudge } from './rules/debug-print-nudge'

export const register: Register = on => {
  const rules = [debugPrintNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
