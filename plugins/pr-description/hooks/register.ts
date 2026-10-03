import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as prDescription } from './rules/pr-description'

export const register: Register = on => registerCommands(on, [prDescription])
