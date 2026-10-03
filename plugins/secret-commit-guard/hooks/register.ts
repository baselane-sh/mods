import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretCommit } from './rules/secret-commit'

export const register: Register = on => registerGuards(on, [secretCommit])
