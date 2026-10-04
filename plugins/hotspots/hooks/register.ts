import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as hotspots } from './rules/hotspots'

export const register: Register = on => registerCommands(on, [hotspots])
