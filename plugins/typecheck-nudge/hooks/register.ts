import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as typecheckNudge } from './rules/typecheck-nudge'

export const register: Register = on => registerNudges(on, [typecheckNudge()])
