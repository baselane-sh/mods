import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as envinfo } from './rules/envinfo'

export const register: Register = on => registerCommands(on, [envinfo])
