import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as latteMeter } from './rules/latte-meter'

export const register: Register = (on, options) => registerBand(on, [latteMeter], options)
