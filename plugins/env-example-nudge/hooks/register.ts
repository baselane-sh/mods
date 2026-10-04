import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as envExampleNudge } from './rules/env-example-nudge'

export const register: Register = on => registerNudges(on, [envExampleNudge()])
