import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as streakFlame } from './rules/streak-flame'

export const register: Register = (on, options) => registerBand(on, [streakFlame], options)
