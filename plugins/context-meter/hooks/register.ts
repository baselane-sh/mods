import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as contextMeter } from './rules/context-meter'

export const register: Register = (on, options) => {
  const rules = [contextMeter]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
