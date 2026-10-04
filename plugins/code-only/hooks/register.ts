import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as codeOnly } from './rules/code-only'

export const register: Register = (on, options) => registerStyles(on, [codeOnly], options)
