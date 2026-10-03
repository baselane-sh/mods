import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as costMeter } from './rules/cost-meter'

export const register: Register = (on, options) => registerBand(on, [costMeter], options)
