import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as rubberDuck } from './rules/rubber-duck'

export const register: Register = (on, options) => {
  const rules = [rubberDuck]
  addStaticSections(on, rules, options)
}
