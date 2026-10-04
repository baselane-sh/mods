import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as todos } from './rules/todos'

export const register: Register = on => registerCommands(on, [todos])
