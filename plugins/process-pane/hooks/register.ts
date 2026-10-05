import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as processPane } from './rules/process-pane'

export const register: Register = on => registerPanes(on, [processPane])
