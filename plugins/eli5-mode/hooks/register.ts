import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as eli5Mode } from './rules/eli5-mode'

export const register: Register = (on, options) => registerStyles(on, [eli5Mode], options)
