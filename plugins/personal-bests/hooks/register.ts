import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as personalBests } from './rules/personal-bests'

export const register: Register = on => registerStats(on, [personalBests])
