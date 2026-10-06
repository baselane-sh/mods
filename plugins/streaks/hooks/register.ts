import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as streaks } from './rules/streaks'

export const register: Register = on => {
  const rules = [streaks]
  registerStats(on, rules)
  answerStatsCommands(on, [streaks])
}
