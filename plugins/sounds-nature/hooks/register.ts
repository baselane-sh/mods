import type { Register } from 'claude-code'

import { registerSounds } from './engine'
import { rule as nature } from './rules/nature'

export const register: Register = (on, options) => registerSounds(on, [nature], options)
