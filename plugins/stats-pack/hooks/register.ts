import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as wrapped } from './rules/wrapped'
import { rule as streaks } from './rules/streaks'
import { rule as achievements } from './rules/achievements'

export const register: Register = on => registerStats(on, [wrapped, streaks, achievements])
