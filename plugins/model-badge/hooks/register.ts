import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { rule as modelBadge } from './rules/model-badge'

export const register: Register = (on, options) => {
  const rules = [modelBadge]
  registerBand(on, rules, options)
  endTurns(on, rules)
}
