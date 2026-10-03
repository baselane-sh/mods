import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as receipt } from './rules/receipt'
import { rule as standup } from './rules/standup'
import { rule as changelog } from './rules/changelog'
import { rule as prDescription } from './rules/pr-description'
import { rule as handoff } from './rules/handoff'

export const register: Register = on => registerCommands(on, [receipt, standup, changelog, prDescription, handoff])
