import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as typecheckNudge } from './rules/typecheck-nudge'
import { create as lockfileNudge } from './rules/lockfile-nudge'
import { create as bigDiffNudge } from './rules/big-diff-nudge'

export const register: Register = on => registerNudges(on, [typecheckNudge(), lockfileNudge(), bigDiffNudge()])
