import type { Register } from 'claude-code'

import { sessionEndWithJournal } from './hosts/journal'
import { rule as sessionJournal } from './rules/session-journal'

export const register: Register = (on, options) => {
  const rules = [sessionJournal]
  sessionEndWithJournal(on, rules, options)
}
