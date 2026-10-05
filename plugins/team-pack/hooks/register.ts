import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as conventionalCommits } from './rules/conventional-commits'
import { rule as tddMode } from './rules/tdd-mode'
import { rule as securityMode } from './rules/security-mode'

export const register: Register = (on, options) => {
  const rules = [conventionalCommits, tddMode, securityMode]
  addStaticSections(on, rules, options)
}
