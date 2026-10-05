import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as britishEnglish } from './rules/british-english'

export const register: Register = (on, options) => registerStyles(on, [britishEnglish], options)
