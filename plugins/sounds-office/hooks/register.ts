import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as office } from './rules/office'

export const register: Register = (on, options) => {
  const rules = [office]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
