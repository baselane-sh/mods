import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as dbReset } from './rules/db-reset'

export const register: Register = on => registerGuards(on, [dbReset])
