import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as dailySpend } from './rules/daily-spend'

export const register: Register = (on, options) => {
  const rules = [dailySpend]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
