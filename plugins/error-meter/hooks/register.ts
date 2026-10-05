import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCalls } from './hosts/calls'
import { endTurns } from './hosts/turn-end'
import { rule as errorMeter } from './rules/error-meter'

export const register: Register = (on, options) => {
  const rules = [errorMeter]
  registerBand(on, rules, options)
  watchCalls(on, rules)
  endTurns(on, rules)
}
