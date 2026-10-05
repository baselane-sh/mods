import { expect, test } from 'claude-code/testing'

import { publishesIn } from '../hooks/rules/publish'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['npm publish', 'npm publish'],
  ['npm publish --access public', 'npm publish'],
  ['npm --prefix packages/core publish', 'npm publish'],
  ['npm run build && npm publish', 'npm publish'],
  ['pnpm publish', 'pnpm publish'],
  ['pnpm -r publish --no-git-checks', 'pnpm publish'],
  ['pnpm --filter core publish', 'pnpm publish'],
  ['yarn publish --new-version 1.2.0', 'yarn publish'],
  ['yarn npm publish', 'yarn npm publish'],
  ['bun publish', 'bun publish'],
  ['cargo publish', 'cargo publish'],
  ['cargo +nightly publish -p core', 'cargo publish'],
  ['twine upload dist/*', 'twine upload'],
  ['python -m twine upload dist/*', 'twine upload'],
  ['python3 -m twine upload --repository pypi dist/*', 'twine upload'],
  ['uv run twine upload dist/*', 'twine upload'],
  ['gem push mygem-1.0.0.gem', 'gem push'],
  ['poetry publish --build', 'poetry publish'],
  ['uv publish', 'uv publish'],
  ['sudo npm publish', 'npm publish'],
  ['bash -c "npm publish"', 'npm publish'],
]
const MISSES = [
  'npm publish --dry-run',
  'pnpm publish --dry-run',
  'cargo publish --dry-run',
  'cargo publish -n',
  'poetry publish --dry-run',
  'uv publish --dry-run',
  'bun publish --dry-run',
  'npm pack',
  'npm run publish',
  'npm view react version',
  'npm install',
  'cargo build --release',
  'twine check dist/*',
  'gem install rails',
  'gem build mygem.gemspec',
  'poetry build',
  'echo "npm publish"',
  'git commit -m "npm publish fix"',
  'grep -r "cargo publish" docs',
  'cat <<EOF\nnpm publish\nEOF',
]

test('publish-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: publishesIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: publishesIn(command) }).toEqual({ command, found: [] })
})

test('publish-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
