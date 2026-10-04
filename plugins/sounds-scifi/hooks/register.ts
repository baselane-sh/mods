import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as scifi } from './rules/scifi'

export const register: Register = (on, options) => registerSounds(on, [scifi], options)
