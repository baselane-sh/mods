import type { Register } from 'claude-code'

import { checkCallsWithRun } from './hosts/check-run'
import { rule as publish } from './rules/publish'
import { rule as tag } from './rules/tag'
import { rule as deploy } from './rules/deploy'
import { rule as registryPush } from './rules/registry-push'

export const register: Register = on => {
  const rules = [publish, tag, deploy, registryPush]
  checkCallsWithRun(on, rules)
}
