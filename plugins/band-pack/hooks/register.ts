import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as costMeter } from './rules/cost-meter'
import { rule as latteMeter } from './rules/latte-meter'
import { rule as contextMeter } from './rules/context-meter'
import { rule as dailySpend } from './rules/daily-spend'

export const register: Register = (on, options) => registerBand(on, [costMeter, latteMeter, contextMeter, dailySpend], options)
