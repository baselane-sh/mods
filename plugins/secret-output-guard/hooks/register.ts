import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretOutput } from './rules/secret-output'

export const register: Register = on => registerGuards(on, [secretOutput])
