import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithGitRun } from './hosts/command-git-run'
import { answerCommandsWithFiles } from './hosts/command-files'
import { rule as secretScan } from './rules/secret-scan'
import { rule as conflicts } from './rules/conflicts'
import { rule as licenses } from './rules/licenses'

export const register: Register = on => {
  const rules = [secretScan, conflicts, licenses]
  registerCommands(on, rules)
  answerCommandsWithGitRun(on, [secretScan, conflicts])
  answerCommandsWithFiles(on, [licenses])
}
