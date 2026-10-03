import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as standup } from './rules/standup'

export const register: Register = on => registerCommands(on, [standup])
