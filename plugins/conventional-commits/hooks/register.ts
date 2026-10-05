import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as conventionalCommits } from './rules/conventional-commits'

export const register: Register = (on, options) => {
  const rules = [conventionalCommits]
  addStaticSections(on, rules, options)
}
