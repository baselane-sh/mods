import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { endTurns } from './hosts/turn-end'
import { rule as aheadBehind } from './rules/ahead-behind'

export const register: Register = (on, options) => {
  const rules = [aheadBehind]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  endTurns(on, rules)
}
