import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as newPackage } from './rules/new-package'

export const register: Register = on => registerGuards(on, [newPackage])
