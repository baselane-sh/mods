import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as socraticMode } from './rules/socratic-mode'
import { rule as rubberDuck } from './rules/rubber-duck'
import { rule as reviewerMode } from './rules/reviewer-mode'

export const register: Register = (on, options) => {
  const rules = [socraticMode, rubberDuck, reviewerMode]
  addStaticSections(on, rules, options)
}
