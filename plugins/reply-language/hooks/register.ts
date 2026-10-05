import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as replyLanguage } from './rules/reply-language'

export const register: Register = (on, options) => {
  const rules = [replyLanguage]
  addStaticSections(on, rules, options)
}
