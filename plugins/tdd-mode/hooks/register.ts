import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as tddMode } from './rules/tdd-mode'

export const register: Register = (on, options) => {
  const rules = [tddMode]
  addStaticSections(on, rules, options)
}
