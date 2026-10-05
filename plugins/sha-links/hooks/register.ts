import type { Register } from 'claude-code'

import { drawToolRowsWithRepo } from './hosts/row-reads'
import { drawTextWithRepo } from './hosts/text-reads'
import { create as shaLinks } from './rules/sha-links'

export const register: Register = on => {
  const rules = [shaLinks()]
  drawToolRowsWithRepo(on, rules)
  drawTextWithRepo(on, rules)
}
