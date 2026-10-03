import { expect, test } from 'claude-code/testing'

import { touchesSecretFile } from '../hooks/rules/secret-filename'
import { probe } from './probe'

const HITS = [
  'cat .env',
  'cat .env.local',
  'grep KEY config/.env.production',
  'scp id_rsa host:',
  'cat ~/.ssh/id_ed25519',
  'cat server.pem',
  'cat secrets.yaml',
  'cat ~/.aws/credentials',
  'cat ~/.npmrc',
  'cat my-serviceaccount-prod.json',
  'cat AuthKey_ABC.p8',
]
const MISSES = ['cat .env.example', 'cat .env.template', 'ls', 'git status', 'npm test']

test('secret-filename-guard: name table', () => {
  for (const command of HITS) expect({ command, hit: touchesSecretFile(command) }).toEqual({ command, hit: true })
  for (const command of MISSES) expect({ command, hit: touchesSecretFile(command) }).toEqual({ command, hit: false })
})

test('secret-filename-guard: asks through the engine', async ($, on) => {
  const guard = probe($, on)
  for (const command of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
})
