import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as timelinePane } from './rules/timeline-pane'

export const register: Register = on => registerPanes(on, [timelinePane])
