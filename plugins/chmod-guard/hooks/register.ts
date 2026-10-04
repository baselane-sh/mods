import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as chmod } from './rules/chmod'

export const register: Register = on => registerGuards(on, [chmod])
