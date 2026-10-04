import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as sizeBadge } from './rules/size-badge'

export const register: Register = on => registerRender(on, [sizeBadge()])
