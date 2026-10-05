import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchTickers } from './hosts/tickers'
import { startSession } from './hosts/start'
import { endTurns } from './hosts/turn-end'
import { rule as pomodoro } from './rules/pomodoro'

export const register: Register = (on, options) => {
  const rules = [pomodoro]
  registerBand(on, rules, options)
  watchTickers(on, rules)
  startSession(on, rules)
  endTurns(on, rules)
}
