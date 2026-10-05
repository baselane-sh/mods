import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { noteResults } from './hosts/notes'
import { rule as secretOutput } from './rules/secret-output'

export const register: Register = on => {
  const rules = [secretOutput]
  checkCalls(on, rules)
  noteResults(on, rules)
}
