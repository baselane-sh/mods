import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as cavemanMode } from './rules/caveman-mode'
import { rule as gitmojiCommits } from './rules/gitmoji-commits'

export const register: Register = (on, options) => {
  const rules = [cavemanMode, gitmojiCommits]
  addStaticSections(on, rules, options)
}
