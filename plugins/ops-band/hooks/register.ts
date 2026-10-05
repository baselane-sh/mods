import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as aheadBehind } from './rules/ahead-behind'
import { rule as ciBand } from './rules/ci-band'
import { rule as batteryBand } from './rules/battery-band'

export const register: Register = (on, options) => registerBand(on, [aheadBehind, ciBand, batteryBand], options)
