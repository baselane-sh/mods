import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as minimal } from './rules/minimal'

export const register: Register = (on, options) => {
  const rules = [minimal]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
