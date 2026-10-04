import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as achievements } from './rules/achievements'

export const register: Register = on => registerStats(on, [achievements])
