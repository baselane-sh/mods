import type { Register } from 'claude-code'

import { registerPanes, createPanes } from './engine'
import { openPanes } from './hosts/panes'
import { rule as contextPane } from './rules/context-pane'

export const register: Register = on => {
  const rules = [contextPane]
  const shared = createPanes()
  registerPanes(on, rules, shared)
  openPanes(on, rules, shared)
}
