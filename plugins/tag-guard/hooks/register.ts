import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as tag } from './rules/tag'

export const register: Register = on => registerGuards(on, [tag])
