import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as steMode } from './rules/ste-mode'

export const register: Register = (on, options) => registerStyles(on, [steMode], options)
