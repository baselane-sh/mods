import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as sudo } from './rules/sudo'

export const register: Register = on => {
  const rules = [sudo]
  checkCalls(on, rules)
}
