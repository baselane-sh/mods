import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as batteryBand } from './rules/battery-band'

export const register: Register = (on, options) => registerBand(on, [batteryBand], options)
