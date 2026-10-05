import type { Register } from 'claude-code'

import { checkCallsWithPaths } from './hosts/check-paths'
import { rule as migration } from './rules/migration'

export const register: Register = on => {
  const rules = [migration]
  checkCallsWithPaths(on, rules)
}
