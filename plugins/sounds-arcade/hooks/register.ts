import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as arcade } from './rules/arcade'

export const register: Register = (on, options) => {
  const rules = [arcade]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
