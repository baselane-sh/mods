import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as docstringMode } from './rules/docstring-mode'

export const register: Register = (on, options) => registerStyles(on, [docstringMode], options)
