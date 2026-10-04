import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as debugPrintNudge } from './rules/debug-print-nudge'

export const register: Register = on => registerNudges(on, [debugPrintNudge()])
