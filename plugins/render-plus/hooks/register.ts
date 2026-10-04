import type { Register } from 'claude-code'

import { registerRender } from './engine'
import { create as timeBadge } from './rules/time-badge'
import { create as exitBadge } from './rules/exit-badge'
import { create as sizeBadge } from './rules/size-badge'

export const register: Register = on => registerRender(on, [timeBadge(), exitBadge(), sizeBadge()])
