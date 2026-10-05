import type { Register } from 'claude-code'

import { drawToolRows } from './hosts/row'
import { drawTextWithFiles } from './hosts/text-files'
import { create as diffStats } from './rules/diff-stats'
import { create as fileLinks } from './rules/file-links'

export const register: Register = on => {
  const rules = [diffStats(), fileLinks()]
  drawToolRows(on, rules)
  drawTextWithFiles(on, rules)
}
