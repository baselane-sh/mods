import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as dailySpend } from './rules/daily-spend'

export const register: Register = (on, options) => registerBand(on, [dailySpend], options)
