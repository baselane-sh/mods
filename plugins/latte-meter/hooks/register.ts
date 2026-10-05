import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as latteMeter } from './rules/latte-meter'

export const register: Register = (on, options) => {
  const rules = [latteMeter]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
