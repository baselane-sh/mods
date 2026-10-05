import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { watchCallsWithRun } from './hosts/calls-run'
import { startSessionWithFetchers } from './hosts/start-run'
import { endTurnsWithFetchers } from './hosts/turn-end-run'
import { stopTicks } from './hosts/session-end'
import { rule as beadsBand } from './rules/beads-band'
import { rule as beadNow } from './rules/bead-now'
import { rule as epicBar } from './rules/epic-bar'
import { rule as beadsDoneBar } from './rules/beads-done-bar'
import { rule as beadsTodayBar } from './rules/beads-today-bar'
import { rule as priorityBar } from './rules/priority-bar'

export const register: Register = (on, options) => {
  const rules = [beadsBand, beadNow, epicBar, beadsDoneBar, beadsTodayBar, priorityBar]
  registerBand(on, rules, options)
  watchCallsWithRun(on, rules)
  startSessionWithFetchers(on, rules)
  endTurnsWithFetchers(on, rules)
  stopTicks(on, rules)
}
