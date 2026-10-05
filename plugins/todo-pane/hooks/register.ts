import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanesWithRun } from './hosts/panes-run'
import { rule as todoPane } from './rules/todo-pane'

export const register: Register = on => {
  const rules = [todoPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanesWithRun(on, rules, shared)
}
