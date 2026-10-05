import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { playOnTurnEnd } from './hosts/turn'
import { rule as nature } from './rules/nature'

export const register: Register = (on, options) => {
  const rules = [nature]
  registerSounds(on, rules, options)
  playOnTurnEnd(on, rules, options)
}
