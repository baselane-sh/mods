import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as noSycophancy } from './rules/no-sycophancy'

export const register: Register = (on, options) => registerStyles(on, [noSycophancy], options)
