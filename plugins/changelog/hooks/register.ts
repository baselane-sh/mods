import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as changelog } from './rules/changelog'

export const register: Register = on => registerCommands(on, [changelog])
