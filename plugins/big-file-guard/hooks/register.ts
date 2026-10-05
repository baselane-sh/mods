import type { Register } from 'claude-code'

import { checkCallsWithAll } from './hosts/check-all'
import { rule as bigFile } from './rules/big-file'

export const register: Register = on => {
  const rules = [bigFile]
  checkCallsWithAll(on, rules)
}
