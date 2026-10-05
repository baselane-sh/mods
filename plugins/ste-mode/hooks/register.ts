import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as steMode } from './rules/ste-mode'

export const register: Register = (on, options) => {
  const rules = [steMode]
  addStaticSections(on, rules, options)
}
