import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as langs } from './rules/langs'

export const register: Register = on => {
  const rules = [langs]
  registerStats(on, rules)
  answerStatsCommands(on, [langs])
}
