import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as newPackage } from './rules/new-package'

export const register: Register = on => {
  const rules = [newPackage]
  checkCalls(on, rules)
}
