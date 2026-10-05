import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as arcade } from './rules/arcade'

export const register: Register = (on, options) => registerSounds(on, [arcade], options)
