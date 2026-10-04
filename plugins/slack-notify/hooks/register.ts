import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as slackNotify } from './rules/slack-notify'

export const register: Register = (on, options) => registerLifecycle(on, [slackNotify], options)
