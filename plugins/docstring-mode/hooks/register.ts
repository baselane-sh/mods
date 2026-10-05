import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as docstringMode } from './rules/docstring-mode'

export const register: Register = (on, options) => {
  const rules = [docstringMode]
  addStaticSections(on, rules, options)
}
