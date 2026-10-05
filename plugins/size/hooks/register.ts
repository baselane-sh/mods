import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGitRun } from './hosts/command-git-run'
import { rule as size } from './rules/size'

export const register: Register = on => {
  const rules = [size]
  registerCommands(on, rules)
  answerCommandsWithGitRun(on, [size])
}
