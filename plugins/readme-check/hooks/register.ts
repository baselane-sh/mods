import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithFiles } from './hosts/command-files'
import { rule as readmeCheck } from './rules/readme-check'

export const register: Register = on => {
  const rules = [readmeCheck]
  registerCommands(on, rules)
  answerCommandsWithFiles(on, [readmeCheck])
}
