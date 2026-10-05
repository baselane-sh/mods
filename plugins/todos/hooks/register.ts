import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as todos } from './rules/todos'

export const register: Register = on => {
  const rules = [todos]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [todos])
}
