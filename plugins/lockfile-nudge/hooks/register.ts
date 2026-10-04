import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as lockfileNudge } from './rules/lockfile-nudge'

export const register: Register = on => registerNudges(on, [lockfileNudge()])
