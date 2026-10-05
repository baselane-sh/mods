import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as registryPush } from './rules/registry-push'

export const register: Register = on => {
  const rules = [registryPush]
  checkCalls(on, rules)
}
