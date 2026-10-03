import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as pirateMode } from './rules/pirate-mode'

export const register: Register = (on, options) => registerStyles(on, [pirateMode], options)
