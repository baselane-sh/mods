import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGit } from './hosts/command-git'
import { rule as standup } from './rules/standup'

export const register: Register = on => {
  const rules = [standup]
  registerCommands(on, rules)
  answerCommandsWithGit(on, [standup])
}
