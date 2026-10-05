import type { Register } from 'claude-code'

import { registerBand } from './engine'
import { rule as nowPlaying } from './rules/now-playing'

export const register: Register = (on, options) => registerBand(on, [nowPlaying], options)
