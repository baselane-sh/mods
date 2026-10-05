import type { Register } from 'claude-code'

import { drawToolResults } from './hosts/result'
import { create as urlLinks } from './rules/url-links'

export const register: Register = on => {
  const rules = [urlLinks()]
  drawToolResults(on, rules)
}
