import type { Register } from 'claude-code'

import { checkCallsWithRun } from './hosts/check-run'
import { rule as gitignore } from './rules/gitignore'

export const register: Register = on => {
  const rules = [gitignore]
  checkCallsWithRun(on, rules)
}
