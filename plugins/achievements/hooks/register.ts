import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as achievements } from './rules/achievements'

export const register: Register = on => {
  const rules = [achievements]
  registerStats(on, rules)
  answerStatsCommands(on, [achievements])
}
