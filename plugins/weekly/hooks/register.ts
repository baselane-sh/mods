import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as weekly } from './rules/weekly'

export const register: Register = on => {
  const rules = [weekly]
  registerStats(on, rules)
  answerStatsCommands(on, [weekly])
}
