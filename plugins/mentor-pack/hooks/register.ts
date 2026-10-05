import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as socraticMode } from './rules/socratic-mode'
import { rule as rubberDuck } from './rules/rubber-duck'
import { rule as reviewerMode } from './rules/reviewer-mode'

export const register: Register = (on, options) => registerStyles(on, [socraticMode, rubberDuck, reviewerMode], options)
