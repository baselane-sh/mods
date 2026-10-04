import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as wrapped } from './rules/wrapped'

export const register: Register = on => registerStats(on, [wrapped])
