import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { startSessionWithFetchers } from './hosts/start-run'
import { endTurnsWithFetchers } from './hosts/turn-end-run'
import { stopTicks } from './hosts/session-end'
import { rule as beadsDoneBar } from './rules/beads-done-bar'

export const register: Register = (on, options) => {
  const rules = [beadsDoneBar]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  startSessionWithFetchers(on, rules)
  endTurnsWithFetchers(on, rules)
  stopTicks(on, rules)
}
