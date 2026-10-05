import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as noirMode } from './rules/noir-mode'

export const register: Register = (on, options) => {
  const rules = [noirMode]
  addStaticSections(on, rules, options)
}
