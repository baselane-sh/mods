import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as stashes } from './rules/stashes'

export const register: Register = on => {
  const rules = [stashes]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [stashes])
}
