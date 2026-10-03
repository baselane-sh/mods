import type { Register } from 'claude-code'

import { registerStyles } from './engine'
import { rule as replyLanguage } from './rules/reply-language'

export const register: Register = (on, options) => registerStyles(on, [replyLanguage], options)
