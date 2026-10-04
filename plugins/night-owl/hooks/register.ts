import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as nightOwl } from './rules/night-owl'

export const register: Register = on => registerStats(on, [nightOwl])
