import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as conventionalCommits } from './rules/conventional-commits'
import { rule as tddMode } from './rules/tdd-mode'
import { rule as securityMode } from './rules/security-mode'

export const register: Register = (on, options) => registerStyles(on, [conventionalCommits, tddMode, securityMode], options)
