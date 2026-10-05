import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as scifi } from './rules/scifi'

export const register: Register = (on, options) => {
  const rules = [scifi]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
