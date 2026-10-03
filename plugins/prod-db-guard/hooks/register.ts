import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as prodDb } from './rules/prod-db'

export const register: Register = on => registerGuards(on, [prodDb])
