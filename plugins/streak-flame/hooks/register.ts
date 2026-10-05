import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as streakFlame } from './rules/streak-flame'

export const register: Register = (on, options) => {
  const rules = [streakFlame]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
