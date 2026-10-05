import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as yodaMode } from './rules/yoda-mode'

export const register: Register = (on, options) => {
  const rules = [yodaMode]
  addStaticSections(on, rules, options)
}
