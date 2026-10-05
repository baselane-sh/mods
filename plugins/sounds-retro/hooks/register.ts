import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as retro } from './rules/retro'

export const register: Register = (on, options) => {
  const rules = [retro]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
