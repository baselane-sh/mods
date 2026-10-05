import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as socraticMode } from './rules/socratic-mode'

export const register: Register = (on, options) => {
  const rules = [socraticMode]
  addStaticSections(on, rules, options)
}
