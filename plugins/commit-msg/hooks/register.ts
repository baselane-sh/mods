import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as commitMsg } from './rules/commit-msg'

export const register: Register = on => {
  const rules = [commitMsg]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [commitMsg])
}
