import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as branches } from './rules/branches'

export const register: Register = on => {
  const rules = [branches]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [branches])
}
