import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as nightOwl } from './rules/night-owl'

export const register: Register = on => {
  const rules = [nightOwl]
  registerStats(on, rules)
  answerStatsCommands(on, [nightOwl])
}
