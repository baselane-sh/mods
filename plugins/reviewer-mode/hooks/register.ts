import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as reviewerMode } from './rules/reviewer-mode'

export const register: Register = (on, options) => {
  const rules = [reviewerMode]
  addStaticSections(on, rules, options)
}
