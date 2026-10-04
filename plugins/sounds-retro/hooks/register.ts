import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as retro } from './rules/retro'

export const register: Register = (on, options) => registerSounds(on, [retro], options)
