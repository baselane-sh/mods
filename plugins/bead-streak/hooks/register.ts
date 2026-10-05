import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as beadStreak } from './rules/bead-streak'

export const register: Register = on => registerStats(on, [beadStreak])
