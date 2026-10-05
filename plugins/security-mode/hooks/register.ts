import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as securityMode } from './rules/security-mode'

export const register: Register = (on, options) => {
  const rules = [securityMode]
  addStaticSections(on, rules, options)
}
