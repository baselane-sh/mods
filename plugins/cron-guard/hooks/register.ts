import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as cron } from './rules/cron'

export const register: Register = on => registerGuards(on, [cron])
