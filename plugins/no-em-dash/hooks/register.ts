import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as noEmDash } from './rules/no-em-dash'

export const register: Register = (on, options) => {
  const rules = [noEmDash]
  addStaticSections(on, rules, options)
}
