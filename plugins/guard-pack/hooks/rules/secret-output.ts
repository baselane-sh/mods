import type { ToolCallResult } from 'claude-code'

import type { GuardRule } from '../engine'
import { redact, SECRET_VALUE } from '../patterns'

// After Bash or Read answered, scans what came back for credential shapes.
// It cannot un-read the value; it tells the model not to repeat, store or
// commit it, and names the source so the person can rotate the credential.
// The value itself is never quoted.
const SOURCE_CHARS = 120

const outputOf = (ran: ToolCallResult): string => ran.text ?? JSON.stringify(ran.result ?? '')

export const rule: GuardRule = {
  id: 'secret-output-guard',
  decision: 'ask',
  check: () => undefined,
  after: (e, ran) => {
    if ((e.tool !== 'Bash' && e.tool !== 'Read') || !SECRET_VALUE.test(outputOf(ran))) return undefined
    const source =
      e.tool === 'Bash' ? `the command \`${redact(e.command).slice(0, SOURCE_CHARS)}\`` : `the file ${e.file_path}`
    return `the output of ${source} contains what looks like a live credential. Do NOT repeat, quote, store or commit the value; refer to it only as "the credential from that source". Tell the person it entered the transcript and recommend rotating it.`
  },
}
