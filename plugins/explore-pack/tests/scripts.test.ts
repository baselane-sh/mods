import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const git = { ...IN_REPO, 'rev-parse --show-toplevel': '/repo\n' }
const at = (files: Readonly<Record<string, string>>) => ({
  git,
  contents: Object.fromEntries(Object.entries(files).map(([name, text]) => [`/repo/${name}`, text])),
})

const PACKAGE = JSON.stringify({ name: 'x', scripts: { build: 'tsc -p .', test: 'vitest run' }, dependencies: { a: '1' } })

const MAKEFILE = [
  'CC := gcc',
  '.PHONY: build test',
  '',
  'build: main.o',
  '\t$(CC) -o app main.o',
  '',
  '%.o: %.c',
  '\t$(CC) -c $<',
  '',
  'test:',
  '\t./run-tests',
  'test:',
  '\t@echo again',
  'docker-up: ## start containers',
  '\tdocker compose up',
].join('\n')

const JUSTFILE = [
  'set shell := ["bash", "-c"]',
  'version := "1.0"',
  '',
  '# build it',
  'build target="debug":',
  '    cargo build',
  '',
  '@dev: build',
  '    cargo run',
  '',
  'alias b := build',
].join('\n')

const PYPROJECT = [
  '[project]',
  'name = "x"',
  '',
  '[project.scripts]',
  'mytool = "pkg.cli:main"',
  'other = "pkg.other:run"',
  '',
  '[tool.poetry.scripts]',
  'poet = "pkg.poet:go"',
  '',
  '[tool.ruff]',
  'line-length = 100',
].join('\n')

test('scripts: registers /scripts with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'scripts')?.description).toMatch(/tasks/i)
})

test('scripts: package.json scripts with their commands', async ($, on) => {
  const session = probe($, on, at({ 'package.json': PACKAGE }))
  const text = await session.run('scripts')
  expect(text).toContain(['package.json (2)', '  build  tsc -p .', '  test  vitest run'].join('\n'))
  expect(text.startsWith('Runnable tasks')).toBe(true)
  expect(session.copied().length).toBe(1)
})

test('scripts: Makefile targets, without patterns, variables or duplicates', async ($, on) => {
  const session = probe($, on, at({ Makefile: MAKEFILE }))
  const text = await session.run('scripts')
  expect(text).toContain(['Makefile (3)', '  build', '  test', '  docker-up'].join('\n'))
  expect(text).not.toContain('.PHONY')
  expect(text).not.toContain('%.o')
  expect(text).not.toContain('CC')
})

test('scripts: justfile recipes, without settings, variables or aliases', async ($, on) => {
  const session = probe($, on, at({ justfile: JUSTFILE }))
  const text = await session.run('scripts')
  expect(text).toContain(['justfile (2)', '  build', '  dev'].join('\n'))
  expect(text).not.toContain('version')
  expect(text).not.toContain('shell')
  expect(text).not.toContain('alias')
})

test('scripts: pyproject project.scripts and poetry scripts', async ($, on) => {
  const session = probe($, on, at({ 'pyproject.toml': PYPROJECT }))
  const text = await session.run('scripts')
  expect(text).toContain(['pyproject.toml (3)', '  mytool  pkg.cli:main', '  other  pkg.other:run', '  poet  pkg.poet:go'].join('\n'))
  expect(text).not.toContain('line-length')
})

test('scripts: groups are set apart by a blank line, in a fixed order', async ($, on) => {
  const session = probe($, on, at({ justfile: JUSTFILE, 'package.json': PACKAGE }))
  const text = await session.run('scripts')
  expect(text.indexOf('package.json (2)')).toBeLessThan(text.indexOf('justfile (2)'))
  expect(text).toContain('\n\njustfile (2)')
})

test('scripts: a lowercase makefile and a Justfile are found', async ($, on) => {
  const session = probe($, on, at({ makefile: 'all:\n\techo', Justfile: 'go:\n  echo' }))
  const text = await session.run('scripts')
  expect(text).toContain('Makefile (1)\n  all')
  expect(text).toContain('justfile (1)\n  go')
})

test('scripts: a long command is shortened', async ($, on) => {
  const session = probe($, on, at({ 'package.json': JSON.stringify({ scripts: { big: 'x'.repeat(300) } }) }))
  await session.run('scripts')
  const row = (session.copied()[0] ?? '').split('\n').find(l => l.startsWith('  big')) ?? ''
  expect(row.length).toBeLessThanOrEqual(100)
  expect(row.endsWith('...')).toBe(true)
})

test('scripts: a package.json that does not parse is named, the rest still list', async ($, on) => {
  const session = probe($, on, at({ 'package.json': '{ nope', Makefile: 'all:\n\techo' }))
  const text = await session.run('scripts')
  expect(text).toContain('package.json\n  could not be parsed')
  expect(text).toContain('Makefile (1)')
})

test('scripts: files with no tasks say so and copy nothing', async ($, on) => {
  const session = probe($, on, at({ 'package.json': '{"name":"x"}', Makefile: '# nothing\nCC := gcc' }))
  const text = await session.run('scripts')
  expect(text).toBe('No runnable tasks: no package.json scripts, Makefile targets, justfile recipes or pyproject scripts found at the repo root.')
  expect(session.copied()).toEqual([])
})

test('scripts: no files at all says the same', async ($, on) => {
  const session = probe($, on, { git })
  expect(await session.run('scripts')).toMatch(/^No runnable tasks/)
})

test('scripts: caps at 100 rows and counts the rest', async ($, on) => {
  const scripts = Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`s${i}`, 'run']))
  const session = probe($, on, at({ 'package.json': JSON.stringify({ scripts }) }))
  await session.run('scripts')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => /^ {2}s\d+ /.test(l)).length).toBe(100)
  expect(text).toContain('+30 more')
})

test('scripts: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('scripts')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('scripts: no credential reaches the text', async ($, on) => {
  const session = probe($, on, at({ 'package.json': JSON.stringify({ scripts: { db: `psql ${FAKE.postgres}` } }) }))
  const text = await session.run('scripts')
  expect(text + session.copied().join('')).not.toContain('S3cretPass')
})

test('scripts: only lists, never runs, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, at({ 'package.json': PACKAGE, Makefile: MAKEFILE }))
  await session.run('scripts')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
  expect(session.ran().every(c => c.startsWith('git -C /repo rev-parse'))).toBe(true)
})
