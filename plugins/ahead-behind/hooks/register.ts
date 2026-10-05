import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as aheadBehind } from './rules/ahead-behind'

export const register: Register = (on, options) => registerBand(on, [aheadBehind], options)
