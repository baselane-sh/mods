import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanes } from './hosts/panes'
import { measureTurns } from './hosts/turns'
import { rule as costPane } from './rules/cost-pane'

export const register: Register = on => {
  const rules = [costPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanes(on, rules, shared)
  measureTurns(on, rules, shared)
}
