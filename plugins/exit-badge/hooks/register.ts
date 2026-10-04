import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as exitBadge } from './rules/exit-badge'

export const register: Register = on => registerRender(on, [exitBadge()])
