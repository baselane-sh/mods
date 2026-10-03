import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as gitignore } from './rules/gitignore'

export const register: Register = on => registerGuards(on, [gitignore])
