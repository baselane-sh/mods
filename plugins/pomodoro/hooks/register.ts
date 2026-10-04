import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as pomodoro } from './rules/pomodoro'

export const register: Register = (on, options) => registerBand(on, [pomodoro], options)
