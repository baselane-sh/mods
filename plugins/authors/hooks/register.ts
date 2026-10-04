import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as authors } from './rules/authors'

export const register: Register = on => registerCommands(on, [authors])
