import type { Register } from 'claude-code'

import { remindWithUsage } from './hosts/stop-usage'
import { create as ctxNudge } from './rules/ctx-nudge'

export const register: Register = on => {
  const rules = [ctxNudge()]
  remindWithUsage(on, rules)
}
