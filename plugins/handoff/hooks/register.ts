import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as handoff } from './rules/handoff'

export const register: Register = on => registerCommands(on, [handoff])
