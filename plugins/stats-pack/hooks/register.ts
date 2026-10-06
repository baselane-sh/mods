import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { answerStatsCommandsWithCopy } from './hosts/stats-command-copy'
import { answerStatsCommands } from './hosts/stats-command'
import { rule as wrapped } from './rules/wrapped'
import { rule as streaks } from './rules/streaks'
import { rule as achievements } from './rules/achievements'

export const register: Register = on => {
  const rules = [wrapped, streaks, achievements]
  registerStats(on, rules)
  answerStatsCommandsWithCopy(on, [wrapped])
  answerStatsCommands(on, [streaks, achievements])
}
