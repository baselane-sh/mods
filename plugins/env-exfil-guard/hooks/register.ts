import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as envExfil } from './rules/env-exfil'

export const register: Register = on => registerGuards(on, [envExfil])
