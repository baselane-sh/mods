import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithRead } from './hosts/command-read'
import { rule as scripts } from './rules/scripts'

export const register: Register = on => {
  const rules = [scripts]
  registerCommands(on, rules)
  answerCommandsWithRead(on, [scripts])
}
