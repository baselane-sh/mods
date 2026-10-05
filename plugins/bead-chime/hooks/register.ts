import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as beadChime } from './rules/bead-chime'

export const register: Register = (on, options) => registerSounds(on, [beadChime], options)
