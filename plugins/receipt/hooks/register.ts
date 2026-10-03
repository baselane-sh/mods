import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as receipt } from './rules/receipt'

export const register: Register = on => registerCommands(on, [receipt])
