import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as filesPane } from './rules/files-pane'

export const register: Register = on => registerPanes(on, [filesPane])
