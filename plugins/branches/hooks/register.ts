import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as branches } from './rules/branches'

export const register: Register = on => registerCommands(on, [branches])
