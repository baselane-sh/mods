import type { Register } from 'claude-code'

import { needsInputWithRun } from './hosts/input-run'
import { rule as desktopNotify } from './rules/desktop-notify'

export const register: Register = (on, options) => {
  const rules = [desktopNotify]
  needsInputWithRun(on, rules, options)
}
