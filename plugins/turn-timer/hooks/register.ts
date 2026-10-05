import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as turnTimer } from './rules/turn-timer'

export const register: Register = (on, options) => registerBand(on, [turnTimer], options)
