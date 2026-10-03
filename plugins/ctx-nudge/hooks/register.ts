import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as ctxNudge } from './rules/ctx-nudge'

export const register: Register = on => registerNudges(on, [ctxNudge()])
