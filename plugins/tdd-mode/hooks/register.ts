import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as tddMode } from './rules/tdd-mode'

export const register: Register = (on, options) => registerStyles(on, [tddMode], options)
