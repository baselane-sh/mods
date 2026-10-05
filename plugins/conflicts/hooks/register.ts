import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGitRun } from './hosts/command-git-run'
import { rule as conflicts } from './rules/conflicts'

export const register: Register = on => {
  const rules = [conflicts]
  registerCommands(on, rules)
  answerCommandsWithGitRun(on, [conflicts])
}
