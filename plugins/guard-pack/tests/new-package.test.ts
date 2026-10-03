import { expect, test } from 'claude-code/testing'

import { packagesIn, rule } from '../hooks/rules/new-package'
import { NO_TOOLS } from './fixtures'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['npm i left-pad', ['left-pad']],
  ['npm install lodash@4 zod', ['lodash@4', 'zod']],
  ['npm install --save-dev vitest', ['vitest']],
  ['npm install -g typescript', ['typescript']],
  ['npm --prefix web install react', ['react']],
  ['npm install -w apps/web zod', ['zod']],
  ['pnpm add -D tsx', ['tsx']],
  ['pnpm install zod', ['zod']],
  ['pnpm --filter web add react', ['react']],
  ['yarn add @types/node', ['@types/node']],
  ['bun add hono', ['hono']],
  ['pip install requests', ['requests']],
  ['pip3 install -U requests==2.0 flask', ['requests==2.0', 'flask']],
  ['python3 -m pip install rich', ['rich']],
  ['uv pip install httpx', ['httpx']],
  ['uv add --dev pytest', ['pytest']],
  ['poetry add fastapi', ['fastapi']],
  ['cargo add serde --features derive', ['serde']],
  ['go get github.com/gin-gonic/gin@latest', ['github.com/gin-gonic/gin@latest']],
  ['gem install rails -v 7.1', ['rails']],
  ['cd web && npm i zod && npm test', ['zod']],
  ['sudo npm install -g pnpm', ['pnpm']],
]
const MISSES = [
  'npm install',
  'npm i',
  'npm ci',
  'npm install --legacy-peer-deps',
  'npm install .',
  'npm install ./packages/ui',
  'npm run install-hooks',
  'npm test',
  'pnpm install',
  'pnpm install --frozen-lockfile',
  'pnpm add',
  'yarn',
  'yarn install',
  'yarn add',
  'bun install',
  'pip install -r requirements.txt',
  'pip install -e .',
  'pip install .',
  'pip list',
  'uv sync',
  'uv add -r requirements.txt',
  'poetry install',
  'cargo build',
  'cargo add',
  'go get -u ./...',
  'go build ./...',
  'gem list',
  'echo "npm install left-pad"',
  'grep "pip install" README.md',
  'git commit -m "docs: npm install foo"',
  'brew install jq',
]

test('package-guard: command table', () => {
  for (const [command, found] of HITS) expect({ command, found: packagesIn(command) }).toEqual({ command, found })
  for (const command of MISSES) expect({ command, found: packagesIn(command) }).toEqual({ command, found: [] })
})

test('package-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})

test('package-guard: the reason names the packages', async () => {
  const reason = await rule.check({ tool: 'Bash', tool_use_id: 't', command: 'npm i zod left-pad' }, NO_TOOLS)
  expect(reason).toContain('zod')
  expect(reason).toContain('left-pad')
})
