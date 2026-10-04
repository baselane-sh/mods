import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as errorMeter } from './rules/error-meter'

export const register: Register = (on, options) => registerBand(on, [errorMeter], options)
