import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurnsWithStore } from './hosts/turn-end-store'
import { rule as streakFlame } from './rules/streak-flame'

export const register: Register = (on, options) => {
  const rules = [streakFlame]
  registerBand(on, rules, options)
  endTurnsWithStore(on, rules)
}
