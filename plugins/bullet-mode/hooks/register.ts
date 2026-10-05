import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as bulletMode } from './rules/bullet-mode'

export const register: Register = (on, options) => registerStyles(on, [bulletMode], options)
