import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as sessionClock } from './rules/session-clock'

export const register: Register = (on, options) => registerBand(on, [sessionClock], options)
