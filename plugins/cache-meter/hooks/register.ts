import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as cacheMeter } from './rules/cache-meter'

export const register: Register = (on, options) => {
  const rules = [cacheMeter]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
