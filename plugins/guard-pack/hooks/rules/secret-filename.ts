import type { GuardRule } from '../engine'
import { SECRET_NAME, SECRET_NAME_SAFE } from '../patterns'

// The native Read deny rules cannot see shell reads (cat, grep, cp, scp).
// This rule can. It asks rather than denies, so a recursive grep that walks
// past a .env still works after one confirmation.
export const touchesSecretFile = (command: string): boolean =>
  SECRET_NAME.test(command.replace(SECRET_NAME_SAFE, ''))

export const rule: GuardRule = {
  id: 'secret-filename-guard',
  decision: 'ask',
  check: e =>
    e.tool === 'Bash' && touchesSecretFile(e.command)
      ? 'this command references a secret-looking file (.env, private key, credentials). Reading it sends the contents to the model and the local transcript.'
      : undefined,
}
