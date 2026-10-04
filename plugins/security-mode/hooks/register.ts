import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as securityMode } from './rules/security-mode'

export const register: Register = (on, options) => registerStyles(on, [securityMode], options)
