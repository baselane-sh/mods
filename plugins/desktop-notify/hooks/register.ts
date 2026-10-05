import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as desktopNotify } from './rules/desktop-notify'

export const register: Register = (on, options) => registerLifecycle(on, [desktopNotify], options)
