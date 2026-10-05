import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as commitNudge } from './rules/commit-nudge'
import { create as todoNudge } from './rules/todo-nudge'
import { create as debugPrintNudge } from './rules/debug-print-nudge'

export const register: Register = on => {
  const rules = [commitNudge(), todoNudge(), debugPrintNudge()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
