import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as stashes } from './rules/stashes'

export const register: Register = on => registerCommands(on, [stashes])
