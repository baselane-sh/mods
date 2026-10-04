import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as moodRing } from './rules/mood-ring'

export const register: Register = (on, options) => registerBand(on, [moodRing], options)
