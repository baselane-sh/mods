import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as office } from './rules/office'

export const register: Register = (on, options) => registerSounds(on, [office], options)
