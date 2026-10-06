import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as beadStreak } from './rules/bead-streak'

export const register: Register = on => {
  const rules = [beadStreak]
  registerStats(on, rules)
  answerStatsCommands(on, [beadStreak])
}
