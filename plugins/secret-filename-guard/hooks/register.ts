import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as secretFilename } from './rules/secret-filename'

export const register: Register = on => registerGuards(on, [secretFilename])
