import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommands } from './hosts/command'
import { rule as receipt } from './rules/receipt'

export const register: Register = on => {
  const rules = [receipt]
  registerCommands(on, rules)
  answerCommands(on, [receipt])
}
