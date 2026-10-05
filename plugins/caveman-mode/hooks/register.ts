import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as cavemanMode } from './rules/caveman-mode'

export const register: Register = (on, options) => {
  const rules = [cavemanMode]
  addStaticSections(on, rules, options)
}
