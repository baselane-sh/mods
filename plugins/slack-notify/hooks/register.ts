import type { Register } from 'claude-code'

import { needsInputWithPush } from './hosts/input-push'
import { rule as slackNotify } from './rules/slack-notify'

export const register: Register = (on, options) => {
  const rules = [slackNotify]
  needsInputWithPush(on, rules, options)
}
