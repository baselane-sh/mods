import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'security-mode',
  section:
    'Style: security check. Before you finish any change, check it for injection (SQL, shell, template, path), secrets in code or logs, missing authentication or authorization, and unsafe handling of input (no validation, unsafe deserialization, unescaped output). Fix each problem or flag it. End your reply with a line "Security checked:" that lists each risk class and the result (ok, fixed or flagged), and name any class that does not apply. Never say a change is safe without that list. The line goes in your reply, never in a commit message or in code.',
}
