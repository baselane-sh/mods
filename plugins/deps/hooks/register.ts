import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithRead } from './hosts/command-read'
import { rule as deps } from './rules/deps'

export const register: Register = on => {
  const rules = [deps]
  registerCommands(on, rules)
  answerCommandsWithRead(on, [deps])
}
