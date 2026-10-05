import type { Register } from 'claude-code'

import { afterToolWithFilesAndRoot } from './hosts/tool-lint'
import { rule as autoLint } from './rules/auto-lint'

export const register: Register = (on, options) => {
  const rules = [autoLint]
  afterToolWithFilesAndRoot(on, rules, options)
}
