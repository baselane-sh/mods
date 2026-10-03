import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as contextMeter } from './rules/context-meter'

export const register: Register = (on, options) => registerBand(on, [contextMeter], options)
