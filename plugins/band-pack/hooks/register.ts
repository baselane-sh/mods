import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCalls } from './hosts/calls'
import { watchTickers } from './hosts/tickers'
import { startSession } from './hosts/start'
import { endTurns } from './hosts/turn-end'
import { rule as costMeter } from './rules/cost-meter'
import { rule as latteMeter } from './rules/latte-meter'
import { rule as contextMeter } from './rules/context-meter'
import { rule as dailySpend } from './rules/daily-spend'
import { rule as pomodoro } from './rules/pomodoro'
import { rule as moodRing } from './rules/mood-ring'

export const register: Register = (on, options) => {
  const rules = [costMeter, latteMeter, contextMeter, dailySpend, pomodoro, moodRing]
  registerBand(on, rules, options)
  watchCalls(on, rules)
  watchTickers(on, rules)
  startSession(on, rules)
  endTurns(on, rules)
}
