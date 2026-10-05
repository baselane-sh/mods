import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { startSessionWithFetchers } from './hosts/start-run'
import { endTurnsWithFetchers } from './hosts/turn-end-run'
import { stopTicks } from './hosts/session-end'
import { rule as batteryBand } from './rules/battery-band'

export const register: Register = (on, options) => {
  const rules = [batteryBand]
  registerBand(on, rules, options)
  startSessionWithFetchers(on, rules)
  endTurnsWithFetchers(on, rules)
  stopTicks(on, rules)
}
