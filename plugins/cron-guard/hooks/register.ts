import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as cron } from './rules/cron'

export const register: Register = on => {
  const rules = [cron]
  checkCalls(on, rules)
}
