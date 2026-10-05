import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { endTurns } from './hosts/turn-end'
import { stopTicks } from './hosts/session-end'
import { rule as branchBand } from './rules/branch-band'
import { rule as sessionClock } from './rules/session-clock'
import { rule as toolCounter } from './rules/tool-counter'
import { rule as errorMeter } from './rules/error-meter'

export const register: Register = (on, options) => {
  const rules = [branchBand, sessionClock, toolCounter, errorMeter]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  endTurns(on, rules)
  stopTicks(on, rules)
}
