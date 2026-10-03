import type { Register } from 'claude-code'

import { registerGuards } from './engine'
import { rule as curlPipe } from './rules/curl-pipe'

export const register: Register = on => registerGuards(on, [curlPipe])
