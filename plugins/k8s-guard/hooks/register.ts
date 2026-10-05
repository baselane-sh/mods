import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as k8s } from './rules/k8s'

export const register: Register = on => {
  const rules = [k8s]
  checkCalls(on, rules)
}
