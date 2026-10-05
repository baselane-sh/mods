import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as plainEnglish } from './rules/plain-english'

export const register: Register = (on, options) => {
  const rules = [plainEnglish]
  addStaticSections(on, rules, options)
}
