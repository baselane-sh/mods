import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as branchBand } from './rules/branch-band'
import { rule as sessionClock } from './rules/session-clock'
import { rule as toolCounter } from './rules/tool-counter'
import { rule as errorMeter } from './rules/error-meter'

export const register: Register = (on, options) => registerBand(on, [branchBand, sessionClock, toolCounter, errorMeter], options)
