import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as cavemanMode } from './rules/caveman-mode'

export const register: Register = (on, options) => registerStyles(on, [cavemanMode], options)
