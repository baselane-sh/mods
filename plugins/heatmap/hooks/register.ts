import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as heatmap } from './rules/heatmap'

export const register: Register = on => {
  const rules = [heatmap]
  registerStats(on, rules)
  answerStatsCommands(on, [heatmap])
}
