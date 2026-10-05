import type { Register } from 'claude-code'

import { createNotes } from './engine'
import { observeCalls } from './hosts/observe'
import { remindWithModel } from './hosts/stop-model'
import { create as sportsNarrator } from './rules/sports-narrator'

export const register: Register = (on, options) => {
  const rules = [sportsNarrator()]
  const shared = createNotes()
  observeCalls(on, rules)
  remindWithModel(on, rules, options)
}
