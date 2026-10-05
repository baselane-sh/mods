import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCalls } from './hosts/calls'
import { endTurns } from './hosts/turn-end'
import { rule as moodRing } from './rules/mood-ring'

export const register: Register = (on, options) => {
  const rules = [moodRing]
  registerBand(on, rules, options)
  watchCalls(on, rules)
  endTurns(on, rules)
}
