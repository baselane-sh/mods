import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as desktopNotify } from './rules/desktop-notify'
import { rule as sayDone } from './rules/say-done'

export const register: Register = (on, options) => registerLifecycle(on, [desktopNotify, sayDone], options)
