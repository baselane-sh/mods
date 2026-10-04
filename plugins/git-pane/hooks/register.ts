import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as gitPane } from './rules/git-pane'

export const register: Register = on => registerPanes(on, [gitPane])
