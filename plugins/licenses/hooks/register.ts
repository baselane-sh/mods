import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithFiles } from './hosts/command-files'
import { rule as licenses } from './rules/licenses'

export const register: Register = on => {
  const rules = [licenses]
  registerCommands(on, rules)
  answerCommandsWithFiles(on, [licenses])
}
