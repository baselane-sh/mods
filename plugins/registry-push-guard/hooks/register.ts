import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as registryPush } from './rules/registry-push'

export const register: Register = on => registerGuards(on, [registryPush])
