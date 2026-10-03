import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as protectMain } from './rules/protect-main'

export const register: Register = on => registerGuards(on, [protectMain])
