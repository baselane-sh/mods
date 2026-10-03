import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as longRunNotify } from './rules/long-run-notify'

export const register: Register = (on, options) => registerLifecycle(on, [longRunNotify], options)
