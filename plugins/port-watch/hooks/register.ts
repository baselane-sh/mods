import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanesWithRun } from './hosts/panes-run'
import { rule as portWatch } from './rules/port-watch'

export const register: Register = on => {
  const rules = [portWatch]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanesWithRun(on, rules, shared)
}
