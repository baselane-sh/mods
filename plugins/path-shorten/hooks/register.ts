import type { Register } from 'claude-code'

import { drawToolRowsWithPaths } from './hosts/row-paths'
import { create as pathShorten } from './rules/path-shorten'

export const register: Register = on => {
  const rules = [pathShorten()]
  drawToolRowsWithPaths(on, rules)
}
