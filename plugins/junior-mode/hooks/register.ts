import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as juniorMode } from './rules/junior-mode'

export const register: Register = (on, options) => registerStyles(on, [juniorMode], options)
