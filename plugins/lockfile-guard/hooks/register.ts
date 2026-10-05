import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as lockfile } from './rules/lockfile'

export const register: Register = on => {
  const rules = [lockfile]
  checkCalls(on, rules)
}
