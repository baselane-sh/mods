import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as ssh } from './rules/ssh'

export const register: Register = on => registerGuards(on, [ssh])
