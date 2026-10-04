import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as docsNudge } from './rules/docs-nudge'

export const register: Register = on => registerNudges(on, [docsNudge()])
