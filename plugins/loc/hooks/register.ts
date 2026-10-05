import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as loc } from './rules/loc'

export const register: Register = on => {
  const rules = [loc]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [loc])
}
