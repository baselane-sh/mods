import type { Register } from 'claude-code'

import { needsInputWithPush } from './hosts/input-push'
import { rule as discordNotify } from './rules/discord-notify'

export const register: Register = (on, options) => {
  const rules = [discordNotify]
  needsInputWithPush(on, rules, options)
}
