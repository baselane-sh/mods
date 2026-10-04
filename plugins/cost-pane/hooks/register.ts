import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as costPane } from './rules/cost-pane'

export const register: Register = on => registerPanes(on, [costPane])
