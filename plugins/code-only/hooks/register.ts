import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as codeOnly } from './rules/code-only'

export const register: Register = (on, options) => {
  const rules = [codeOnly]
  addStaticSections(on, rules, options)
}
