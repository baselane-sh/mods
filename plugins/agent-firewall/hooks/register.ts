import type { Register } from 'claude-code'

import { registerFirewall } from './engine'
import { rule as summarize } from './rules/summarize'

export const register: Register = on => registerFirewall(on, [summarize])
