import type { Register } from 'claude-code'

import { addStaticSections } from './hosts/static'
import { rule as terseMode } from './rules/terse-mode'

export const register: Register = (on, options) => {
  const rules = [terseMode]
  addStaticSections(on, rules, options)
}
