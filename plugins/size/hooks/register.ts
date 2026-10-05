import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as size } from './rules/size'

export const register: Register = on => registerCommands(on, [size])
