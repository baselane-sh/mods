import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithRun } from './hosts/command-run'
import { rule as envinfo } from './rules/envinfo'

export const register: Register = on => {
  const rules = [envinfo]
  registerCommands(on, rules)
  answerCommandsWithRun(on, [envinfo])
}
