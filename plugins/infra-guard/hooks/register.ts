import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as infra } from './rules/infra'

export const register: Register = on => {
  const rules = [infra]
  checkCalls(on, rules)
}
