import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as bigDiffNudge } from './rules/big-diff-nudge'

export const register: Register = on => registerNudges(on, [bigDiffNudge()])
