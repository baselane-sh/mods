import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { startSessionWithFetchers } from './hosts/start-run'
import { endTurnsWithFetchers } from './hosts/turn-end-run'
import { stopTicks } from './hosts/session-end'
import { rule as turnTimer } from './rules/turn-timer'
import { rule as todoCount } from './rules/todo-count'
import { rule as streakFlame } from './rules/streak-flame'

export const register: Register = (on, options) => {
  const rules = [turnTimer, todoCount, streakFlame]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  startSessionWithFetchers(on, rules)
  endTurnsWithFetchers(on, rules)
  stopTicks(on, rules)
}
