import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as modelBadge } from './rules/model-badge'

export const register: Register = (on, options) => registerBand(on, [modelBadge], options)
