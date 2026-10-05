import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as envExfil } from './rules/env-exfil'

export const register: Register = on => {
  const rules = [envExfil]
  checkCalls(on, rules)
}
