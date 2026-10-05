import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as scripts } from './rules/scripts'

export const register: Register = on => registerCommands(on, [scripts])
