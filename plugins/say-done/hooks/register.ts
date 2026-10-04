import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as sayDone } from './rules/say-done'

export const register: Register = (on, options) => registerLifecycle(on, [sayDone], options)
