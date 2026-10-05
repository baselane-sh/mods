import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as publish } from './rules/publish'

export const register: Register = on => registerGuards(on, [publish])
