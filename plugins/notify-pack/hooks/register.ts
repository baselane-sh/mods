import type { Register } from 'claude-code'

import { needsInputWithRun } from './hosts/input-run'
import { turnEndWithRun } from './hosts/turn-run'
import { rule as desktopNotify } from './rules/desktop-notify'
import { rule as sayDone } from './rules/say-done'

export const register: Register = (on, options) => {
  const rules = [desktopNotify, sayDone]
  needsInputWithRun(on, rules, options)
  turnEndWithRun(on, rules, options)
}
