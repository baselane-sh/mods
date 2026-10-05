import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as gitmojiCommits } from './rules/gitmoji-commits'

export const register: Register = (on, options) => {
  const rules = [gitmojiCommits]
  addStaticSections(on, rules, options)
}
