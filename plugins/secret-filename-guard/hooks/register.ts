import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as secretFilename } from './rules/secret-filename'

export const register: Register = on => {
  const rules = [secretFilename]
  checkCalls(on, rules)
}
