import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as juniorMode } from './rules/junior-mode'

export const register: Register = (on, options) => {
  const rules = [juniorMode]
  addStaticSections(on, rules, options)
}
