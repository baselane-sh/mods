import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanesWithRun } from './hosts/panes-run'
import { rule as gitPane } from './rules/git-pane'

export const register: Register = on => {
  const rules = [gitPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanesWithRun(on, rules, shared)
}
