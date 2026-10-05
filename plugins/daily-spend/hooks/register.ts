import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurnsWithStore } from './hosts/turn-end-store'
import { rule as dailySpend } from './rules/daily-spend'

export const register: Register = (on, options) => {
  const rules = [dailySpend]
  registerBand(on, rules, options)
  endTurnsWithStore(on, rules)
}
