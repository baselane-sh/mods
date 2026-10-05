import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as zen } from './rules/zen'

export const register: Register = (on, options) => registerSounds(on, [zen], options)
