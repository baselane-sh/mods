import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as yodaMode } from './rules/yoda-mode'

export const register: Register = (on, options) => registerStyles(on, [yodaMode], options)
