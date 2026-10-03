import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretValue } from './rules/secret-value'

export const register: Register = on => registerGuards(on, [secretValue])
