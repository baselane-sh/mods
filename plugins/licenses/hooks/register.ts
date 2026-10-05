import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as licenses } from './rules/licenses'

export const register: Register = on => registerCommands(on, [licenses])
