import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as migration } from './rules/migration'

export const register: Register = on => registerGuards(on, [migration])
