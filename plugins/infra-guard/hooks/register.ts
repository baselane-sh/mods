import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as infra } from './rules/infra'

export const register: Register = on => registerGuards(on, [infra])
