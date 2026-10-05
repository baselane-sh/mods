import type { Register } from 'claude-code'

import { checkCallsWithRun } from './hosts/check-run'
import { rule as secretCommit } from './rules/secret-commit'

export const register: Register = on => {
  const rules = [secretCommit]
  checkCallsWithRun(on, rules)
}
