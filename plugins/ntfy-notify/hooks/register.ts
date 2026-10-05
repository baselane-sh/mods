import type { Register } from 'claude-code'

import { needsInputWithPush } from './hosts/input-push'
import { rule as ntfyNotify } from './rules/ntfy-notify'

export const register: Register = (on, options) => {
  const rules = [ntfyNotify]
  needsInputWithPush(on, rules, options)
}
