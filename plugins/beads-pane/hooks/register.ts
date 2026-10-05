import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanesWithRun } from './hosts/panes-run'
import { rule as beadsPane } from './rules/beads-pane'

export const register: Register = on => {
  const rules = [beadsPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanesWithRun(on, rules, shared)
}
