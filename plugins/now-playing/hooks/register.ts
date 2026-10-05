import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { startSessionWithFetchers } from './hosts/start-run'
import { endTurnsWithFetchers } from './hosts/turn-end-run'
import { stopTicks } from './hosts/session-end'
import { rule as nowPlaying } from './rules/now-playing'

export const register: Register = (on, options) => {
  const rules = [nowPlaying]
  registerBand(on, rules, options)
  startSessionWithFetchers(on, rules)
  endTurnsWithFetchers(on, rules)
  stopTicks(on, rules)
}
