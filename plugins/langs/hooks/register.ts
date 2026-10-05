import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as langs } from './rules/langs'

export const register: Register = on => registerStats(on, [langs])
