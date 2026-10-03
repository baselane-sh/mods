import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as plainEnglish } from './rules/plain-english'

export const register: Register = (on, options) => registerStyles(on, [plainEnglish], options)
