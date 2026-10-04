import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as todos } from './rules/todos'
import { rule as loc } from './rules/loc'
import { rule as hotspots } from './rules/hotspots'
import { rule as commitMsg } from './rules/commit-msg'
import { rule as branches } from './rules/branches'

export const register: Register = on => registerCommands(on, [todos, loc, hotspots, commitMsg, branches])
