import type { Register } from 'claude-code'

import { registerPanes } from './engine'
import { rule as contextPane } from './rules/context-pane'

export const register: Register = on => registerPanes(on, [contextPane])
