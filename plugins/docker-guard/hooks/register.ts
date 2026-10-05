import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as docker } from './rules/docker'

export const register: Register = on => {
  const rules = [docker]
  checkCalls(on, rules)
}
