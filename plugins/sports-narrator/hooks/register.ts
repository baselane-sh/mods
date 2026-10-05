import type { Register } from 'claude-code'

import { observeCalls } from './hosts/observe'
import { remindWithModel } from './hosts/stop-model'
import { create as sportsNarrator } from './rules/sports-narrator'

export const register: Register = (on, options) => {
  const rules = [sportsNarrator()]
  observeCalls(on, rules)
  remindWithModel(on, rules, options)
}
