import type { Register } from 'claude-code'

import { afterToolWithFiles } from './hosts/tool-files'
import { rule as autoFormat } from './rules/auto-format'

export const register: Register = (on, options) => {
  const rules = [autoFormat]
  afterToolWithFiles(on, rules, options)
}
