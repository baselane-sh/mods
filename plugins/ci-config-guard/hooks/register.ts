import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as ciConfig } from './rules/ci-config'

export const register: Register = on => {
  const rules = [ciConfig]
  checkCalls(on, rules)
}
