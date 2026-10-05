import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as noirMode } from './rules/noir-mode'

export const register: Register = (on, options) => registerStyles(on, [noirMode], options)
