import type { Register } from 'claude-code'

import { checkCallsWithRun } from './hosts/check-run'
import { rule as protectMain } from './rules/protect-main'

export const register: Register = on => {
  const rules = [protectMain]
  checkCallsWithRun(on, rules)
}
