import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as todoNudge } from './rules/todo-nudge'

export const register: Register = on => registerNudges(on, [todoNudge()])
