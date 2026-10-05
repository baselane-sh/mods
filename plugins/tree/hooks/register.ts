import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as tree } from './rules/tree'

export const register: Register = on => registerCommands(on, [tree])
