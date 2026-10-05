import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as upload } from './rules/upload'

export const register: Register = on => registerGuards(on, [upload])
