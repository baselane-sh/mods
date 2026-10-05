import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as conflicts } from './rules/conflicts'

export const register: Register = on => registerCommands(on, [conflicts])
