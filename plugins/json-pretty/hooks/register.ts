import type { Register } from 'claude-code'

import { drawToolResults } from './hosts/result'
import { create as jsonPretty } from './rules/json-pretty'

export const register: Register = on => {
  const rules = [jsonPretty()]
  drawToolResults(on, rules)
}
