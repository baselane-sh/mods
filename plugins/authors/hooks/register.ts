import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as authors } from './rules/authors'

export const register: Register = on => {
  const rules = [authors]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [authors])
}
