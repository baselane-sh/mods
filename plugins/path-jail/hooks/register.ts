import type { Register } from 'claude-code'

import { checkCallsWithPaths } from './hosts/check-paths'
import { rule as pathJail } from './rules/path-jail'

export const register: Register = on => {
  const rules = [pathJail]
  checkCallsWithPaths(on, rules)
}
