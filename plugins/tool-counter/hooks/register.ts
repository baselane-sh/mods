import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as toolCounter } from './rules/tool-counter'

export const register: Register = (on, options) => registerBand(on, [toolCounter], options)
