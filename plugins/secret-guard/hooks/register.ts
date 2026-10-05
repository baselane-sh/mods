import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { notePrompts } from './hosts/prompt-notes'
import { rule as secretValue } from './rules/secret-value'

export const register: Register = on => {
  const rules = [secretValue]
  checkCalls(on, rules)
  notePrompts(on, rules)
}
