import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as ntfyNotify } from './rules/ntfy-notify'

export const register: Register = (on, options) => registerLifecycle(on, [ntfyNotify], options)
