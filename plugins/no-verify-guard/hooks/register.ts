import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as noVerify } from './rules/no-verify'

export const register: Register = on => registerGuards(on, [noVerify])
