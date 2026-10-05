import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGitRun } from './hosts/command-git-run'
import { rule as secretScan } from './rules/secret-scan'

export const register: Register = on => {
  const rules = [secretScan]
  registerCommands(on, rules)
  answerCommandsWithGitRun(on, [secretScan])
}
