import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanes } from './hosts/panes'
import { rule as testPane } from './rules/test-pane'

export const register: Register = on => {
  const rules = [testPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanes(on, rules, shared)
}
