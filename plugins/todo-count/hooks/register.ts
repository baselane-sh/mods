import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as todoCount } from './rules/todo-count'

export const register: Register = (on, options) => registerBand(on, [todoCount], options)
