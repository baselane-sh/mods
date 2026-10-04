import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as conventionalCommits } from './rules/conventional-commits'

export const register: Register = (on, options) => registerStyles(on, [conventionalCommits], options)
