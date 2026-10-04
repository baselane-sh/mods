import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as testPane } from './rules/test-pane'

export const register: Register = on => registerPanes(on, [testPane])
