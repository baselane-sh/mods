import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as fileOwners } from './rules/file-owners'

export const register: Register = on => {
  const rules = [fileOwners]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [fileOwners])
}
