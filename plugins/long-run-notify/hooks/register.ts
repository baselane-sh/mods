import type { Register } from 'claude-code'

import { afterToolWithPush } from './hosts/tool-push'
import { rule as longRunNotify } from './rules/long-run-notify'

export const register: Register = (on, options) => {
  const rules = [longRunNotify]
  afterToolWithPush(on, rules, options)
}
