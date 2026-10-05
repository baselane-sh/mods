import type { Register } from 'claude-code'

import { checkCalls } from './hosts/check'
import { rule as curlPipe } from './rules/curl-pipe'

export const register: Register = on => {
  const rules = [curlPipe]
  checkCalls(on, rules)
}
