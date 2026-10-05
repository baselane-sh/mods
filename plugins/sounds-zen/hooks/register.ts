import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as zen } from './rules/zen'

export const register: Register = (on, options) => {
  const rules = [zen]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
