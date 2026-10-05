import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { answerCommandsWithBd } from './hosts/command-bd'
import { rule as beadsStandup } from './rules/beads-standup'

export const register: Register = on => {
  const rules = [beadsStandup]
  registerCommands(on, rules)
  answerCommandsWithBd(on, [beadsStandup])
}
