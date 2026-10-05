import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as secretScan } from './rules/secret-scan'

export const register: Register = on => registerCommands(on, [secretScan])
