import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as prDescription } from './rules/pr-description'

export const register: Register = on => {
  const rules = [prDescription]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [prDescription])
}
