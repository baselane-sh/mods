import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithWrite } from './hosts/command-write'
import { rule as handoff } from './rules/handoff'

export const register: Register = on => {
  const rules = [handoff]
  registerCommands(on, rules)
  answerCommandsWithWrite(on, [handoff])
}
