import { expect, test } from 'claude-code/testing'

import { skippedHooksIn } from '../hooks/rules/no-verify'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['git commit --no-verify -m "wip"', '--no-verify'],
  ['git commit -m "wip" --no-verify', '--no-verify'],
  ['git push --no-verify origin main', '--no-verify'],
  ['git -C ../other commit --no-verify -m x', '--no-verify'],
  ['git add . && git commit -n -m "wip"', 'commit -n'],
  ['git commit -nm "wip"', 'commit -n'],
  ['git commit -anm "wip"', 'commit -n'],
  ['git commit -am "x" -n', 'commit -n'],
  ['HUSKY=0 git commit -m "wip"', 'HUSKY=0'],
  ['export HUSKY=0', 'HUSKY=0'],
  ['HUSKY=0; git commit -m x', 'HUSKY=0'],
  ['git -c core.hooksPath=/dev/null commit -m x', 'core.hooksPath=/dev/null'],
  ['git config core.hooksPath /dev/null', 'core.hooksPath=/dev/null'],
  ['git rebase --no-verify main', '--no-verify'],
]
const MISSES = [
  'echo "no-verify"',
  'git commit -m "docs: explain --no-verify"',
  'git commit -m "--no-verify"',
  'git commit -m "fix: handle -n flag"',
  'git commit -mnothing',
  'git log -n 5',
  'git push -n origin main',
  'git push origin main',
  'git -c user.name=x commit -m x',
  'git -c core.hooksPath=.githooks commit -m x',
  'HUSKY=0 npm install',
  'grep -r "no-verify" docs',
  'git log --grep=--no-verify',
  'npm run lint -- -n',
  'git commit -m x -- -n',
]

test('no-verify-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: skippedHooksIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: skippedHooksIn(command) }).toEqual({ command, found: [] })
})

test('no-verify-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
