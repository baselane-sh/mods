import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as deploy } from './rules/deploy'

export const register: Register = on => registerGuards(on, [deploy])
