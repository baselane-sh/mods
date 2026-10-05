import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as changelog } from './rules/changelog'

export const register: Register = on => {
  const rules = [changelog]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [changelog])
}
