import type { GuardRule } from '../engine'
import { SECRET_VALUE } from '../patterns'

// Catches live key material being pasted, written or run, where
// secret-filename-guard only watches file names.
const WATCHED = new Set<string>(['Bash', 'Write', 'Edit'])

export const rule: GuardRule = {
  id: 'secret-guard',
  decision: 'ask',
  check: e =>
    WATCHED.has(String(e.tool)) && SECRET_VALUE.test(JSON.stringify(e))
      ? 'this looks like a live credential value (API key, token, private key, connection string with a password). Writing or running it puts the secret into the transcript, a file or a commit. Use an env var or a secret manager reference instead.'
      : undefined,
}
