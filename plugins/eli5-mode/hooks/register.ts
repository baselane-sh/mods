import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as eli5Mode } from './rules/eli5-mode'

export const register: Register = (on, options) => {
  const rules = [eli5Mode]
  addStaticSections(on, rules, options)
}
