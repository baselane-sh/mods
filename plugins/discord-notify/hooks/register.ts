import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as discordNotify } from './rules/discord-notify'

export const register: Register = (on, options) => registerLifecycle(on, [discordNotify], options)
