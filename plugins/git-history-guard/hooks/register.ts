import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as gitHistory } from './rules/git-history'

export const register: Register = on => registerGuards(on, [gitHistory])
