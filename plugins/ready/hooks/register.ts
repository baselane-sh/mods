import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithBd } from './hosts/command-bd'
import { rule as ready } from './rules/ready'

export const register: Register = on => {
  const rules = [ready]
  registerCommands(on, rules)
  answerCommandsWithBd(on, [ready])
}
