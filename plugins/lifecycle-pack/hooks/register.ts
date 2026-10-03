import type { Register } from 'claude-code'

import { registerLifecycle } from './engine'
import { rule as autoFormat } from './rules/auto-format'
import { rule as longRunNotify } from './rules/long-run-notify'
import { rule as ntfyNotify } from './rules/ntfy-notify'
import { rule as sessionJournal } from './rules/session-journal'

export const register: Register = (on, options) => registerLifecycle(on, [autoFormat, longRunNotify, ntfyNotify, sessionJournal], options)
