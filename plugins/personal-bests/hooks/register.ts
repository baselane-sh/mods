import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as personalBests } from './rules/personal-bests'

export const register: Register = on => {
  const rules = [personalBests]
  registerStats(on, rules)
  answerStatsCommands(on, [personalBests])
}
