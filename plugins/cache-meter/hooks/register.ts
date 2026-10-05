import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as cacheMeter } from './rules/cache-meter'

export const register: Register = (on, options) => registerBand(on, [cacheMeter], options)
