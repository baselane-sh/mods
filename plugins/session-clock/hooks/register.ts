import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { endTurns } from './hosts/turn-end'
import { stopTicks } from './hosts/session-end'
import { rule as sessionClock } from './rules/session-clock'

export const register: Register = (on, options) => {
  const rules = [sessionClock]
  registerBand(on, rules, options)
  endTurns(on, rules)
  stopTicks(on, rules)
}
