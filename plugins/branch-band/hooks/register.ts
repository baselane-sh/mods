import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { endTurns } from './hosts/turn-end'
import { rule as branchBand } from './rules/branch-band'

export const register: Register = (on, options) => {
  const rules = [branchBand]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  endTurns(on, rules)
}
