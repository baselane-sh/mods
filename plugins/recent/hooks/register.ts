import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as recent } from './rules/recent'

export const register: Register = on => registerCommands(on, [recent])
