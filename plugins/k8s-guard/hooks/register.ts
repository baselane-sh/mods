import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as k8s } from './rules/k8s'

export const register: Register = on => registerGuards(on, [k8s])
