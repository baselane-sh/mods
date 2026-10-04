import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as gitmojiCommits } from './rules/gitmoji-commits'

export const register: Register = (on, options) => registerStyles(on, [gitmojiCommits], options)
