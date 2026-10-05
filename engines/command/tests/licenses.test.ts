import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const git = { ...IN_REPO, 'rev-parse --show-toplevel': '/repo\n' }
const pkg = (license: unknown) => JSON.stringify({ name: 'x', license })
const SP = '/repo/.venv/lib/python3.12/site-packages'

const at = (contents: Record<string, string>, extra: { files?: string[]; dirs?: Record<string, string[]> } = {}) => ({
  git,
  contents: Object.fromEntries(Object.entries(contents).map(([name, text]) => [name.startsWith('/') ? name : `/repo/${name}`, text])),
  ...extra,
})

const ROOT_PKG = JSON.stringify({ dependencies: { react: '^18', '@scope/tool': '1' }, devDependencies: { vitest: '^1' } })

test('licenses: registers /licenses with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'licenses')?.description).toMatch(/licence/i)
})

test('licenses: reads each npm dependency from node_modules, unknown when absent', async ($, on) => {
  const session = probe(
    $,
    on,
    at(
      {
        'package.json': ROOT_PKG,
        'node_modules/react/package.json': pkg('MIT'),
        'node_modules/@scope/tool/package.json': pkg({ type: 'Apache-2.0' }),
      },
      { files: ['/repo/node_modules'] },
    ),
  )
  const text = await session.run('licenses')
  expect(text).toContain('npm (3)')
  expect(text).toContain('  @scope/tool  Apache-2.0')
  expect(text).toContain('  react  MIT')
  expect(text).toContain('  vitest  unknown')
  expect(text).not.toContain('node_modules not found')
})

test('licenses: the old licenses array, a long licence text and bad JSON', async ($, on) => {
  const session = probe(
    $,
    on,
    at(
      {
        'package.json': JSON.stringify({ dependencies: { a: '1', b: '1', c: '1' } }),
        'node_modules/a/package.json': JSON.stringify({ licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }] }),
        'node_modules/b/package.json': pkg('x'.repeat(200)),
        'node_modules/c/package.json': '{not json',
      },
      { files: ['/repo/node_modules'] },
    ),
  )
  const text = await session.run('licenses')
  expect(text).toContain('  a  MIT OR GPL-2.0')
  expect(text).toContain('  b  unknown')
  expect(text).toContain('  c  unknown')
})

test('licenses: without node_modules every npm licence is unknown and it says why', async ($, on) => {
  const session = probe($, on, at({ 'package.json': ROOT_PKG }))
  const text = await session.run('licenses')
  expect(text).toContain('node_modules not found, so every licence is unknown')
  expect(text).toContain('  react  unknown')
})

test('licenses: python from dist-info METADATA, by expression, field or classifier', async ($, on) => {
  const meta = (headers: string[]) => `Metadata-Version: 2.1\nName: x\n${headers.join('\n')}\n\nLicense: GPL in the body must not count\n`
  const session = probe(
    $,
    on,
    at(
      {
        'requirements.txt': 'requests>=2\nPyYAML\nsome_pkg\nnolicense\n',
        [`${SP}/requests-2.31.0.dist-info/METADATA`]: meta(['License-Expression: Apache-2.0']),
        [`${SP}/PyYAML-6.0.dist-info/METADATA`]: meta(['License: MIT']),
        [`${SP}/some_pkg-1.0.dist-info/METADATA`]: meta(['License: UNKNOWN', 'Classifier: License :: OSI Approved :: BSD License']),
        [`${SP}/nolicense-1.0.dist-info/METADATA`]: meta(['Summary: nothing']),
      },
      {
        dirs: {
          '/repo/.venv/lib': ['python3.12/'],
          [SP]: ['requests-2.31.0.dist-info/', 'PyYAML-6.0.dist-info/', 'some_pkg-1.0.dist-info/', 'nolicense-1.0.dist-info/', 'other.py'],
        },
      },
    ),
  )
  const text = await session.run('licenses')
  expect(text).toContain('python (4)')
  expect(text).toContain('  requests  Apache-2.0')
  expect(text).toContain('  PyYAML  MIT')
  expect(text).toContain('  some_pkg  BSD License')
  expect(text).toContain('  nolicense  unknown')
  expect(text).not.toContain('GPL')
})

test('licenses: a python dependency with no virtualenv is unknown; names match across - _ .', async ($, on) => {
  const session = probe($, on, at({ 'requirements.txt': 'My-Pkg\nother\n', [`${SP}/my_pkg-1.dist-info/METADATA`]: 'License-Expression: MIT\n' }, { dirs: { '/repo/.venv/lib': ['python3.12/'], [SP]: ['my_pkg-1.dist-info/'] } }))
  const text = await session.run('licenses')
  expect(text).toContain('  My-Pkg  MIT')
  expect(text).toContain('  other  unknown')
})

test('licenses: pyproject dependencies count too', async ($, on) => {
  const session = probe($, on, at({ 'pyproject.toml': '[project]\nname = "x"\ndependencies = ["rich>=13"]\n' }))
  expect(await session.run('licenses')).toContain('  rich  unknown')
})

test('licenses: no manifest says so and copies nothing', async ($, on) => {
  const session = probe($, on, at({}))
  expect(await session.run('licenses')).toBe('No direct dependencies found in package.json, pyproject.toml or requirements.txt.')
  expect(session.copied()).toEqual([])
})

test('licenses: a long list is capped', async ($, on) => {
  const deps = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`dep${String(i).padStart(3, '0')}`, '1']))
  const session = probe($, on, at({ 'package.json': JSON.stringify({ dependencies: deps }) }))
  const text = await session.run('licenses')
  expect(text).toMatch(/\+\d+ more/)
  expect(text).not.toContain('dep129')
})

test('licenses: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('licenses')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('licenses: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, at({ 'package.json': ROOT_PKG }))
  await session.run('licenses')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
