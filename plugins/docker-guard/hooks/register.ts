import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as docker } from './rules/docker'

export const register: Register = on => registerGuards(on, [docker])
