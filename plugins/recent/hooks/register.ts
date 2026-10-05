import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as recent } from './rules/recent'

export const register: Register = on => {
  const rules = [recent]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [recent])
}
