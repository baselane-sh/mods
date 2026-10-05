import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as rubberDuck } from './rules/rubber-duck'

export const register: Register = (on, options) => registerStyles(on, [rubberDuck], options)
