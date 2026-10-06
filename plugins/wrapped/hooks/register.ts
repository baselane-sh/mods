import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommandsWithCopy } from './hosts/stats-command-copy'
import { rule as wrapped } from './rules/wrapped'

export const register: Register = on => {
  const rules = [wrapped]
  registerStats(on, rules)
  answerStatsCommandsWithCopy(on, [wrapped])
}
