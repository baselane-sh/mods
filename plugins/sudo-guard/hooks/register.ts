import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as sudo } from './rules/sudo'

export const register: Register = on => registerGuards(on, [sudo])
