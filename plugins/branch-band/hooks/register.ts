import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as branchBand } from './rules/branch-band'

export const register: Register = (on, options) => registerBand(on, [branchBand], options)
