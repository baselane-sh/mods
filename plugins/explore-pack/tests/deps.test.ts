import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const git = { ...IN_REPO, 'rev-parse --show-toplevel': '/repo\n' }
const at = (files: Readonly<Record<string, string>>) => ({
  git,
  contents: Object.fromEntries(Object.entries(files).map(([name, text]) => [`/repo/${name}`, text])),
})

const PACKAGE = JSON.stringify({
  name: 'x',
  dependencies: { react: '^18.2.0', zod: '3.22.0' },
  devDependencies: { vitest: '^1.0.0' },
  peerDependencies: { typescript: '>=5' },
})

const PYPROJECT = [
  '[project]',
  'name = "x"',
  'dependencies = [',
  '  "requests>=2.31",  # http',
  '  "pydantic[email]>=2,<3",',
  '  "rich",',
  '  "tomli; python_version < \'3.11\'",',
  ']',
  '',
  '[project.optional-dependencies]',
  'cli = ["click>=8"]',
  '',
  '[tool.poetry.dependencies]',
  'python = "^3.11"',
  'httpx = "^0.27"',
  'numpy = { version = "^1.26", optional = true }',
  'local = { path = "../local" }',
  '',
  '[tool.poetry.group.dev.dependencies]',
  'pytest = "^8.0"',
  '',
  '[tool.other]',
  'ignored = "1"',
].join('\n')

const CARGO = [
  '[package]',
  'name = "x"',
  '',
  '[dependencies]',
  'serde = { version = "1.0", features = ["derive"] }',
  'anyhow = "1"',
  'shared = { workspace = true }',
  '',
  '[dependencies.tokio]',
  'version = "1.35"',
  '',
  '[dev-dependencies]',
  'insta = "1.34"',
].join('\n')

const GOMOD = [
  'module example.com/x',
  '',
  'go 1.22',
  '',
  'require (',
  '\tgithub.com/a/b v1.2.3',
  '\tgithub.com/c/d v0.4.0 // indirect',
  ')',
  '',
  'require github.com/e/f v2.0.0',
  'require github.com/g/h v1.0.0 // indirect',
].join('\n')

const REQUIREMENTS = [
  '# pinned',
  'flask==3.0.0',
  'gunicorn>=21,<23  # server',
  '-r base.txt',
  '--index-url https://pypi.example/simple',
  '',
  'requests',
  'uvicorn[standard]~=0.27 ; python_version >= "3.9"',
].join('\n')

test('deps: registers /deps with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'deps')?.description).toMatch(/dependenc/i)
})

test('deps: package.json lists dependencies with versions and kinds', async ($, on) => {
  const session = probe($, on, at({ 'package.json': PACKAGE }))
  const text = await session.run('deps')
  expect(text).toContain(
    ['package.json (4)', '  react  ^18.2.0', '  zod  3.22.0', '  vitest  ^1.0.0  (dev)', '  typescript  >=5  (peer)'].join('\n'),
  )
  expect(text.startsWith('Direct dependencies')).toBe(true)
  expect(session.copied().length).toBe(1)
})

test('deps: pyproject.toml reads project, optional and poetry tables', async ($, on) => {
  const session = probe($, on, at({ 'pyproject.toml': PYPROJECT }))
  const text = await session.run('deps')
  expect(text).toContain('pyproject.toml (9)')
  for (const row of [
    '  requests  >=2.31',
    '  pydantic  >=2,<3',
    '  rich  *',
    '  tomli  *',
    '  click  >=8  (optional)',
    '  httpx  ^0.27',
    '  numpy  ^1.26',
    '  local  (path)',
    '  pytest  ^8.0  (dev)',
  ]) expect(text).toContain(row)
  expect(text).not.toContain('python  ^3.11')
  expect(text).not.toContain('ignored')
})

test('deps: requirements.txt skips options, comments and blanks', async ($, on) => {
  const session = probe($, on, at({ 'requirements.txt': REQUIREMENTS }))
  const text = await session.run('deps')
  expect(text).toContain(['requirements.txt (4)', '  flask  ==3.0.0', '  gunicorn  >=21,<23', '  requests  *', '  uvicorn  ~=0.27'].join('\n'))
  expect(text).not.toContain('base.txt')
  expect(text).not.toContain('index-url')
})

test('deps: go.mod lists direct requires, not indirect ones', async ($, on) => {
  const session = probe($, on, at({ 'go.mod': GOMOD }))
  const text = await session.run('deps')
  expect(text).toContain(['go.mod (2)', '  github.com/a/b  v1.2.3', '  github.com/e/f  v2.0.0'].join('\n'))
  expect(text).not.toContain('github.com/c/d')
  expect(text).not.toContain('github.com/g/h')
})

test('deps: Cargo.toml reads inline tables, sub-tables and dev dependencies', async ($, on) => {
  const session = probe($, on, at({ 'Cargo.toml': CARGO }))
  const text = await session.run('deps')
  expect(text).toContain(
    ['Cargo.toml (5)', '  serde  1.0', '  anyhow  1', '  shared  (workspace)', '  tokio  1.35', '  insta  1.34  (dev)'].join('\n'),
  )
})

test('deps: groups by file in a fixed order, separated by a blank line', async ($, on) => {
  const session = probe($, on, at({ 'go.mod': GOMOD, 'package.json': PACKAGE }))
  const text = await session.run('deps')
  expect(text.indexOf('package.json (4)')).toBeLessThan(text.indexOf('go.mod (2)'))
  expect(text).toContain('\n\ngo.mod (2)')
})

test('deps: a file that does not parse is named, the others still list', async ($, on) => {
  const session = probe($, on, at({ 'package.json': '{ not json', 'go.mod': GOMOD }))
  const text = await session.run('deps')
  expect(text).toContain('package.json\n  could not be parsed')
  expect(text).toContain('go.mod (2)')
})

test('deps: a file with no dependencies is listed as empty', async ($, on) => {
  const session = probe($, on, at({ 'package.json': '{"name":"x"}' }))
  expect(await session.run('deps')).toContain('package.json (0)\n  none')
})

test('deps: no dependency file says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git })
  const text = await session.run('deps')
  expect(text).toBe('No package.json, pyproject.toml, requirements.txt, go.mod or Cargo.toml at the repo root.')
  expect(session.copied()).toEqual([])
})

test('deps: caps at 100 rows and counts the rest', async ($, on) => {
  const deps = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`pkg${i}`, '1.0.0']))
  const session = probe($, on, at({ 'package.json': JSON.stringify({ dependencies: deps }) }))
  await session.run('deps')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => l.startsWith('  pkg')).length).toBe(100)
  expect(text).toContain('+30 more')
})

test('deps: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('deps')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('deps: no credential reaches the text', async ($, on) => {
  const session = probe($, on, at({ 'requirements.txt': `${FAKE.postgres}\nflask==1` }))
  const text = await session.run('deps')
  expect(text).toContain('flask  ==1')
  expect(text + session.copied().join('')).not.toContain('S3cretPass')
})

test('deps: never uses the network, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, at({ 'package.json': PACKAGE, 'go.mod': GOMOD }))
  await session.run('deps')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
  expect(session.ran().every(c => c.startsWith('git -C /repo rev-parse'))).toBe(true)
})
