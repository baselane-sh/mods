import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithRead } from './hosts/command-read'
import { rule as envCheck } from './rules/env-check'

export const register: Register = on => {
  const rules = [envCheck]
  registerCommands(on, rules)
  answerCommandsWithRead(on, [envCheck])
}
