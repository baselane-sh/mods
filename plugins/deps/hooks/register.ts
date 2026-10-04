import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as deps } from './rules/deps'

export const register: Register = on => registerCommands(on, [deps])
