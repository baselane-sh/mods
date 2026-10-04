import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as streaks } from './rules/streaks'

export const register: Register = on => registerStats(on, [streaks])
