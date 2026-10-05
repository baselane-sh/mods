import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as shakespeareMode } from './rules/shakespeare-mode'

export const register: Register = (on, options) => {
  const rules = [shakespeareMode]
  addStaticSections(on, rules, options)
}
