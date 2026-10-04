import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as portWatch } from './rules/port-watch'

export const register: Register = on => registerPanes(on, [portWatch])
