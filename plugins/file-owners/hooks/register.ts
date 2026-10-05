import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as fileOwners } from './rules/file-owners'

export const register: Register = on => registerCommands(on, [fileOwners])
