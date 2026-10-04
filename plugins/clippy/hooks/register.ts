import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as clippy } from './rules/clippy'

export const register: Register = on => registerNudges(on, [clippy()])
