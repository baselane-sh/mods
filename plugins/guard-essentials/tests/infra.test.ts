import { expect, test } from 'claude-code/testing'

import { dangersIn } from '../hooks/rules/infra'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['terraform destroy', 'terraform destroy or apply'],
  ['kubectl delete pod web-1', 'kubectl delete'],
  ['aws ec2 terminate-instances --instance-ids i-1', 'aws delete or terminate'],
  ['git push --force origin main', 'git force-push'],
  ['git push -f', 'git force-push'],
  ['psql -c "DROP TABLE users"', 'SQL DROP'],
  ['rm -rf build', 'rm -rf'],
  ['cd x && rm -fr ~/project', 'rm -rf'],
]
const MISSES = ['rm -rf /tmp/scratch', 'rm -rf node_modules', 'git push origin feat/x', 'terraform plan', 'rm file.txt']

test('infra-guard: danger table', () => {
  for (const [command, danger] of HITS) expect({ command, found: dangersIn(command) }).toEqual({ command, found: [danger] })
  for (const command of MISSES) expect({ command, found: dangersIn(command) }).toEqual({ command, found: [] })
})

test('infra-guard: asks through the engine', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
})
