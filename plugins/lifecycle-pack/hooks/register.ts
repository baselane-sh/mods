import type { Register } from 'claude-code'

import { afterToolWithFilesAndPush } from './hosts/tool-files-push'
import { needsInputWithPush } from './hosts/input-push'
import { sessionEndWithJournal } from './hosts/journal'
import { rule as autoFormat } from './rules/auto-format'
import { rule as longRunNotify } from './rules/long-run-notify'
import { rule as ntfyNotify } from './rules/ntfy-notify'
import { rule as sessionJournal } from './rules/session-journal'

export const register: Register = (on, options) => {
  const rules = [autoFormat, longRunNotify, ntfyNotify, sessionJournal]
  afterToolWithFilesAndPush(on, rules, options)
  needsInputWithPush(on, rules, options)
  sessionEndWithJournal(on, rules, options)
}
