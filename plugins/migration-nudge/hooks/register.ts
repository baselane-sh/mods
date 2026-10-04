import type { Register } from 'claude-code'

import { registerNudges } from './engine'
import { create as migrationNudge } from './rules/migration-nudge'

export const register: Register = on => registerNudges(on, [migrationNudge()])
