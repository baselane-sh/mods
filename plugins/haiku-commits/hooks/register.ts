import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as haikuCommits } from './rules/haiku-commits'

export const register: Register = (on, options) => registerStyles(on, [haikuCommits], options)
