import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as haikuCommits } from './rules/haiku-commits'

export const register: Register = (on, options) => {
  const rules = [haikuCommits]
  addStaticSections(on, rules, options)
}
