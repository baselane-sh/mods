import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurnsWithModel } from './hosts/turn-end-model'
import { rule as modelBadge } from './rules/model-badge'

export const register: Register = (on, options) => {
  const rules = [modelBadge]
  registerBand(on, rules, options)
  endTurnsWithModel(on, rules)
}
