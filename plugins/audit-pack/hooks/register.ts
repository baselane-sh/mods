import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as secretScan } from './rules/secret-scan'
import { rule as conflicts } from './rules/conflicts'
import { rule as licenses } from './rules/licenses'

export const register: Register = on => registerCommands(on, [secretScan, conflicts, licenses])
