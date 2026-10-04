import { expect, test } from 'claude-code/testing'

import { probe } from './probe'
import type { Formatted } from './probe'

// Spliced so this file does not match the shape it carries.
const FAKE = { github: 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789' }

// A fake linter that fixes the file it was given (the last argument).
const fix = (argv: readonly string[], files: Map<string, string>): Formatted => {
  const file = argv[argv.length - 1] ?? ''
  if (files.has(file)) files.set(file, `fixed by ${(argv[0] ?? '').split('/').pop()}\n`)
  return { exitCode: 0 }
}

const linters = (session: { runs: () => readonly { argv: readonly string[]; cwd?: string }[] }) =>
  session.runs().filter(run => run.argv[0] !== 'which')

const ESLINT_BIN = { '/proj/node_modules/.bin/eslint': 'bin' }
const ESLINT_PROJECT = { '/proj/eslint.config.js': 'export default []', '/proj/src/a.ts': 'var x=1\n', ...ESLINT_BIN }
const PROJ = { root: '/proj', cwd: '/proj' }

test('auto-lint: eslint --fix from node_modules runs when eslint.config.js exists', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: ESLINT_PROJECT, format: fix })
  const note = ((await session.edit('/proj/src/a.ts')).context ?? []).join(' ')
  expect(linters(session)).toEqual([{ argv: ['/proj/node_modules/.bin/eslint', '--fix', '/proj/src/a.ts'], cwd: '/proj' }])
  expect(note).toContain('auto-lint: eslint fixed /proj/src/a.ts')
  expect(note).toMatch(/Re-read the file/)
  expect(session.files().get('/proj/src/a.ts')).toBe('fixed by eslint\n')
})

test('auto-lint: silent when the linter changes nothing and finds nothing', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: ESLINT_PROJECT, format: () => ({ exitCode: 0 }) })
  expect((await session.edit('/proj/src/a.ts')).context ?? []).toEqual([])
})

test('auto-lint: no linter config, nothing runs', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/a.ts': 'x', ...ESLINT_BIN }, onPath: { eslint: '/bin/eslint' }, format: fix })
  expect((await session.edit('/proj/a.ts')).context ?? []).toEqual([])
  expect(linters(session)).toEqual([])
})

test('auto-lint: a legacy .eslintrc.json opts in, eslint from PATH', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/.eslintrc.json': '{}', '/proj/a.js': 'x' }, onPath: { eslint: '/usr/bin/eslint' }, format: fix })
  await session.edit('/proj/a.js')
  expect(linters(session).map(run => run.argv)).toEqual([['/usr/bin/eslint', '--fix', '/proj/a.js']])
})

test('auto-lint: eslintConfig in package.json opts in', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/package.json': '{"eslintConfig": {}}', '/proj/a.ts': 'x', ...ESLINT_BIN }, format: fix })
  expect(((await session.edit('/proj/a.ts')).context ?? []).join(' ')).toContain('eslint fixed')
})

test('auto-lint: a config but no binary stays silent', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/eslint.config.mjs': '', '/proj/a.ts': 'x' }, format: fix })
  expect((await session.edit('/proj/a.ts')).context ?? []).toEqual([])
  expect(linters(session)).toEqual([])
})

test('auto-lint: ruff check --fix runs with [tool.ruff] in pyproject.toml', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/pyproject.toml': '[tool.ruff]\n', '/proj/pkg/m.py': 'import os\n' }, onPath: { ruff: '/bin/ruff' }, format: fix })
  const note = ((await session.edit('/proj/pkg/m.py')).context ?? []).join(' ')
  expect(linters(session)).toEqual([{ argv: ['/bin/ruff', 'check', '--fix', '--force-exclude', '--quiet', '/proj/pkg/m.py'], cwd: '/proj' }])
  expect(note).toContain('auto-lint: ruff fixed /proj/pkg/m.py')
})

test('auto-lint: ruff.toml opts in, a bare pyproject.toml does not', async ($, on) => {
  const session = probe($, on, {
    ...PROJ,
    files: { '/proj/a/ruff.toml': '', '/proj/a/m.py': 'x', '/proj/b/pyproject.toml': '[project]\n', '/proj/b/m.py': 'x' },
    onPath: { ruff: '/bin/ruff' },
    format: fix,
  })
  await session.edit('/proj/a/m.py')
  await session.edit('/proj/b/m.py')
  expect(linters(session).map(run => run.argv.at(-1))).toEqual(['/proj/a/m.py'])
})

test('auto-lint: golangci-lint run --fix runs on the package directory', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/.golangci.yml': '', '/proj/go.mod': 'module x\n', '/proj/svc/m.go': 'package svc\n' }, onPath: { 'golangci-lint': '/bin/golangci-lint' }, format: fix })
  await session.edit('/proj/svc/m.go')
  expect(linters(session)).toEqual([{ argv: ['/bin/golangci-lint', 'run', '--fix', '.'], cwd: '/proj/svc' }])
})

test('auto-lint: go.mod alone is not an opt-in to golangci-lint', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj/go.mod': 'module x\n', '/proj/m.go': 'package x\n' }, onPath: { 'golangci-lint': '/bin/golangci-lint' }, format: fix })
  await session.edit('/proj/m.go')
  expect(linters(session)).toEqual([])
})

test('auto-lint: a file outside the project is never linted', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { ...ESLINT_PROJECT, '/other/eslint.config.js': '', '/other/b.ts': 'x', '/other/node_modules/.bin/eslint': 'b' }, format: fix })
  expect((await session.edit('/other/b.ts')).context ?? []).toEqual([])
  expect(linters(session)).toEqual([])
})

test('auto-lint: a path that climbs out with .. is outside the project', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { ...ESLINT_PROJECT, '/proj/../etc/b.ts': 'x', '/etc/b.ts': 'x' }, onPath: { eslint: '/bin/eslint' }, format: fix })
  await session.edit('/proj/../etc/b.ts')
  expect(linters(session)).toEqual([])
})

test('auto-lint: a sibling folder that shares the prefix is outside the project', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/proj-other/eslint.config.js': '', '/proj-other/b.ts': 'x' }, onPath: { eslint: '/bin/eslint' }, format: fix })
  await session.edit('/proj-other/b.ts')
  expect(linters(session)).toEqual([])
})

test('auto-lint: a config above the project root does not opt the project in', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { '/eslint.config.js': '', '/proj/a.ts': 'x' }, onPath: { eslint: '/bin/eslint' }, format: fix })
  await session.edit('/proj/a.ts')
  expect(linters(session)).toEqual([])
})

test('auto-lint: a relative path is read from the session directory', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: ESLINT_PROJECT, format: fix })
  await session.edit('src/a.ts')
  expect(linters(session).map(run => run.argv.at(-1))).toEqual(['/proj/src/a.ts'])
})

test('auto-lint: problems left after the fix reach the model, scrubbed', async ($, on) => {
  const session = probe($, on, {
    ...PROJ,
    files: ESLINT_PROJECT,
    format: () => ({ exitCode: 1, stdout: `1:7 error 'token' is assigned ${FAKE.github} no-unused-vars` }),
  })
  const note = ((await session.edit('/proj/src/a.ts')).context ?? []).join(' ')
  expect(note).toContain('auto-lint: eslint found problems it could not fix in /proj/src/a.ts')
  expect(note).toContain('no-unused-vars')
  expect(note).toContain('[REDACTED]')
  expect(note).not.toContain(FAKE.github)
})

test('auto-lint: a crash is reported with its exit code', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: ESLINT_PROJECT, format: () => ({ exitCode: 2, stderr: 'Oops! Something went wrong' }) })
  const note = ((await session.edit('/proj/src/a.ts')).context ?? []).join(' ')
  expect(note).toContain('auto-lint: eslint failed on /proj/src/a.ts (exit 2): Oops! Something went wrong')
})

test('auto-lint: an Edit is linted, a Read of the same file is not', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: ESLINT_PROJECT, format: fix })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })
  expect(linters(session)).toEqual([])
  await $.tool.call({ tool: 'Edit', file_path: '/proj/src/a.ts', old_string: 'x', new_string: 'y' })
  expect(linters(session).length).toBe(1)
})

test('auto-lint: an unknown extension stays silent', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: { ...ESLINT_PROJECT, '/proj/notes.md': 'hi' }, format: fix })
  await session.edit('/proj/notes.md')
  expect(linters(session)).toEqual([])
})

// golangci-lint --fix rewrites any file of the package, not only the edited one.
const GO_PROJECT = { '/proj/.golangci.yml': '', '/proj/go.mod': 'module x\n', '/proj/svc/a.go': 'package svc\n', '/proj/svc/b.go': 'package svc\n' }
const GOLANGCI = { 'golangci-lint': '/bin/golangci-lint' }

test('auto-lint: golangci-lint names a sibling file it rewrote, not only the edited one', async ($, on) => {
  const fixSibling = (_argv: readonly string[], files: Map<string, string>): Formatted => {
    files.set('/proj/svc/b.go', 'package svc // fixed\n')
    return { exitCode: 0 }
  }
  const session = probe($, on, { ...PROJ, files: GO_PROJECT, onPath: GOLANGCI, format: fixSibling })
  const note = ((await session.edit('/proj/svc/a.go')).context ?? []).join(' ')
  expect(note).toContain('auto-lint: golangci-lint fixed /proj/svc/b.go.')
  expect(note).toMatch(/Re-read/)
  expect(note).not.toContain('fixed /proj/svc/a.go')
})

test('auto-lint: golangci-lint problems are reported for the package, not the edited file', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: GO_PROJECT, onPath: GOLANGCI, format: () => ({ exitCode: 1, stdout: 'b.go:3:1: unused (unused)' }) })
  const note = ((await session.edit('/proj/svc/a.go')).context ?? []).join(' ')
  expect(note).toContain('auto-lint: golangci-lint found problems it could not fix in the package /proj/svc: b.go:3:1: unused (unused)')
})

test('auto-lint: golangci-lint that changes nothing stays silent', async ($, on) => {
  const session = probe($, on, { ...PROJ, files: GO_PROJECT, onPath: GOLANGCI, format: () => ({ exitCode: 0 }) })
  expect((await session.edit('/proj/svc/a.go')).context ?? []).toEqual([])
})
