import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as autoFormat } from './rules/auto-format'

export const register: Register = (on, options) => registerLifecycle(on, [autoFormat], options)
