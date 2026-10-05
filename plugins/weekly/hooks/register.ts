import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as weekly } from './rules/weekly'

export const register: Register = on => registerStats(on, [weekly])
