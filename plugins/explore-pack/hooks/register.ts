import type { Register } from 'claude-code'

import { registerCommands } from './engine'
import { rule as tree } from './rules/tree'
import { rule as deps } from './rules/deps'
import { rule as authors } from './rules/authors'
import { rule as scripts } from './rules/scripts'
import { rule as envCheck } from './rules/env-check'

export const register: Register = on => registerCommands(on, [tree, deps, authors, scripts, envCheck])
