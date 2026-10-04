import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as envCheck } from './rules/env-check'

export const register: Register = on => registerCommands(on, [envCheck])
