import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as bulletMode } from './rules/bullet-mode'

export const register: Register = (on, options) => {
  const rules = [bulletMode]
  addStaticSections(on, rules, options)
}
