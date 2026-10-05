import type { Register } from 'claude-code'

import { drawTextWithRepo } from './hosts/text-reads'
import { create as issueLinks } from './rules/issue-links'

export const register: Register = on => {
  const rules = [issueLinks()]
  drawTextWithRepo(on, rules)
}
