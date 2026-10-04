import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as loc } from './rules/loc'

export const register: Register = on => registerCommands(on, [loc])
