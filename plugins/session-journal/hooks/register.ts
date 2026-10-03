import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as sessionJournal } from './rules/session-journal'

export const register: Register = (on, options) => registerLifecycle(on, [sessionJournal], options)
