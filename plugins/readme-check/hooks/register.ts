import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as readmeCheck } from './rules/readme-check'

export const register: Register = on => registerCommands(on, [readmeCheck])
