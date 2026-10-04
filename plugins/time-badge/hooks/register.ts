import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as timeBadge } from './rules/time-badge'

export const register: Register = on => registerRender(on, [timeBadge()])
