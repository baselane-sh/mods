import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as pirateMode } from './rules/pirate-mode'

export const register: Register = (on, options) => {
  const rules = [pirateMode]
  addStaticSections(on, rules, options)
}
