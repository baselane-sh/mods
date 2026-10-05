import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as britishEnglish } from './rules/british-english'

export const register: Register = (on, options) => {
  const rules = [britishEnglish]
  addStaticSections(on, rules, options)
}
