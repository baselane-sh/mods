import type { Register } from 'claude-code'

import { registerStats } from './engine'
import { rule as heatmap } from './rules/heatmap'

export const register: Register = on => registerStats(on, [heatmap])
