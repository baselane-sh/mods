import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as autoLint } from './rules/auto-lint'

export const register: Register = (on, options) => registerLifecycle(on, [autoLint], options)
