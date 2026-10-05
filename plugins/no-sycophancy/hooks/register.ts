import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as noSycophancy } from './rules/no-sycophancy'

export const register: Register = (on, options) => {
  const rules = [noSycophancy]
  addStaticSections(on, rules, options)
}
