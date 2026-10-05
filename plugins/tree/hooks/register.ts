import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as tree } from './rules/tree'

export const register: Register = on => {
  const rules = [tree]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [tree])
}
