import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as shakespeareMode } from './rules/shakespeare-mode'

export const register: Register = (on, options) => registerStyles(on, [shakespeareMode], options)
