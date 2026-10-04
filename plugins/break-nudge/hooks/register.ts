import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as breakNudge } from './rules/break-nudge'

export const register: Register = on => registerNudges(on, [breakNudge()])
