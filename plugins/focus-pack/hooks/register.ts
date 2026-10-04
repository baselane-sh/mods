import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as commitNudge } from './rules/commit-nudge'
import { create as todoNudge } from './rules/todo-nudge'
import { create as debugPrintNudge } from './rules/debug-print-nudge'

export const register: Register = on => registerNudges(on, [commitNudge(), todoNudge(), debugPrintNudge()])
