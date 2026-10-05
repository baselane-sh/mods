import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindAtStop } from './hosts/stop'
import { create as clippy } from './rules/clippy'

export const register: Register = on => {
  const rules = [clippy()]
  observeCalls(on, rules)
  remindAtStop(on, rules)
}
