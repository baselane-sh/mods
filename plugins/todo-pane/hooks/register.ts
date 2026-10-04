import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as todoPane } from './rules/todo-pane'

export const register: Register = on => registerPanes(on, [todoPane])
