import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as turnTimer } from './rules/turn-timer'
import { rule as todoCount } from './rules/todo-count'
import { rule as streakFlame } from './rules/streak-flame'

export const register: Register = (on, options) => registerBand(on, [turnTimer, todoCount, streakFlame], options)
