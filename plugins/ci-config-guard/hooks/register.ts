import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as ciConfig } from './rules/ci-config'

export const register: Register = on => registerGuards(on, [ciConfig])
