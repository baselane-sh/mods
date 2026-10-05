import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as ciBand } from './rules/ci-band'

export const register: Register = (on, options) => registerBand(on, [ciBand], options)
