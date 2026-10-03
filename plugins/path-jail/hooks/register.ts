import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as pathJail } from './rules/path-jail'

export const register: Register = on => registerGuards(on, [pathJail])
