import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as terseMode } from './rules/terse-mode'

export const register: Register = (on, options) => registerStyles(on, [terseMode], options)
