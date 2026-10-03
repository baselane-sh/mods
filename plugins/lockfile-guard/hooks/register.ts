import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as lockfile } from './rules/lockfile'

export const register: Register = on => registerGuards(on, [lockfile])
