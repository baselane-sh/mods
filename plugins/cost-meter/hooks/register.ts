import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as costMeter } from './rules/cost-meter'

export const register: Register = (on, options) => {
  const rules = [costMeter]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
