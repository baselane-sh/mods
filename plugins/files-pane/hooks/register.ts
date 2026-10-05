import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanes } from './hosts/panes'
import { rule as filesPane } from './rules/files-pane'

export const register: Register = on => {
  const rules = [filesPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanes(on, rules, shared)
}
