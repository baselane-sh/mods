import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as socraticMode } from './rules/socratic-mode'

export const register: Register = (on, options) => registerStyles(on, [socraticMode], options)
