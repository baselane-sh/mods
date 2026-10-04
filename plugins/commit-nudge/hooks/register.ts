import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as commitNudge } from './rules/commit-nudge'

export const register: Register = on => registerNudges(on, [commitNudge()])
