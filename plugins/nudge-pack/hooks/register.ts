import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as testReminder } from './rules/test-reminder'
import { create as ctxNudge } from './rules/ctx-nudge'

export const register: Register = on => registerNudges(on, [testReminder(), ctxNudge()])
