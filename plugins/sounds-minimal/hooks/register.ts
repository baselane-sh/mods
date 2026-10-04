import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as minimal } from './rules/minimal'

export const register: Register = (on, options) => registerSounds(on, [minimal], options)
