import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as reviewerMode } from './rules/reviewer-mode'

export const register: Register = (on, options) => registerStyles(on, [reviewerMode], options)
