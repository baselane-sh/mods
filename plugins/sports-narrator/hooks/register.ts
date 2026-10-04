import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as sportsNarrator } from './rules/sports-narrator'

export const register: Register = (on, options) => registerNudges(on, [sportsNarrator()], options)
