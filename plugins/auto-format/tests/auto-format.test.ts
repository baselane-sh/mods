import { expect, test } from 'claude-code/testing'

import { probe } from './probe'
import type { Formatted } from './probe'

// Spliced so this file does not match the shape it carries.
const FAKE = { github: 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789' }

// A fake formatter: rewrites the last argument, like the kit's test doubles.
const rewrite = (argv: readonly string[], files: Map<string, string>): Formatted => {
  const file = argv[argv.length - 1] ?? ''
  const name = (argv[0] ?? '').split('/').pop()
  files.set(file, `formatted by ${name}\n`)
  return { exitCode: 0 }
}

const NODE_PRETTIER = { '/proj/node_modules/.bin/prettier': 'bin' }
const PRETTIER_PROJECT = { '/proj/.prettierrc': '{}', '/proj/src/a.ts': 'const x=1\n', ...NODE_PRETTIER }

test('auto-format: prettier from node_modules runs when .prettierrc exists', async ($, on) => {
  const session = probe($, on, { files: PRETTIER_PROJECT, format: rewrite })
  const ran = await session.edit('/proj/src/a.ts')
  const note = (ran.context ?? []).join(' ')
  expect(note).toContain('auto-format: reformatted /proj/src/a.ts with prettier')
  expect(note).toMatch(/[Rr]e-read/)
  expect(session.files().get('/proj/src/a.ts')).toBe('formatted by prettier\n')
  expect(session.started()).toEqual([['/proj/node_modules/.bin/prettier', '--write', '--log-level', 'warn', '/proj/src/a.ts']])
})

test('auto-format: silent when the formatter changes nothing', async ($, on) => {
  const session = probe($, on, { files: { ...PRETTIER_PROJECT, '/proj/src/a.ts': 'formatted by prettier\n' }, format: rewrite })
  const ran = await session.edit('/proj/src/a.ts')
  expect(ran.context ?? []).toEqual([])
})

test('auto-format: no config, no run, file untouched', async ($, on) => {
  const session = probe($, on, { files: { '/bare/b.ts': 'const y=2\n' }, onPath: { prettier: '/usr/bin/prettier' }, format: rewrite })
  const ran = await session.edit('/bare/b.ts')
  expect(ran.context ?? []).toEqual([])
  expect(session.started()).toEqual([])
  expect(session.files().get('/bare/b.ts')).toBe('const y=2\n')
})

test('auto-format: prettier from PATH when node_modules has none', async ($, on) => {
  const session = probe($, on, { files: { '/proj/.prettierrc.json': '{}', '/proj/a.ts': 'x' }, onPath: { prettier: '/usr/local/bin/prettier' }, format: rewrite })
  await session.edit('/proj/a.ts')
  expect(session.started().at(-1)?.[0]).toBe('/usr/local/bin/prettier')
})

test('auto-format: a config but no binary stays silent', async ($, on) => {
  const session = probe($, on, { files: { '/proj/.prettierrc': '{}', '/proj/a.ts': 'x' }, format: rewrite })
  const ran = await session.edit('/proj/a.ts')
  expect(ran.context ?? []).toEqual([])
})

test('auto-format: package.json with a prettier key opts in', async ($, on) => {
  const session = probe($, on, { files: { '/p1/package.json': '{"prettier": {}}', '/p1/a.ts': 'x', '/p1/node_modules/.bin/prettier': 'b' }, format: rewrite })
  expect((await session.edit('/p1/a.ts')).context?.join(' ')).toContain('with prettier')
})

test('auto-format: package.json without a prettier key does not', async ($, on) => {
  const session = probe($, on, { files: { '/p2/package.json': '{"name": "x"}', '/p2/a.ts': 'x', '/p2/node_modules/.bin/prettier': 'b' }, format: rewrite })
  expect((await session.edit('/p2/a.ts')).context ?? []).toEqual([])
})

test('auto-format: biome wins over prettier and runs format --write', async ($, on) => {
  const session = probe($, on, {
    files: { '/proj/biome.jsonc': '{}', '/proj/.prettierrc': '{}', '/proj/a.ts': 'x', '/proj/node_modules/.bin/biome': 'b', ...NODE_PRETTIER },
    format: rewrite,
  })
  await session.edit('/proj/a.ts')
  expect(session.started()).toEqual([['/proj/node_modules/.bin/biome', 'format', '--write', '/proj/a.ts']])
})

test('auto-format: ruff runs with [tool.ruff]', async ($, on) => {
  const session = probe($, on, { files: { '/py/pyproject.toml': '[tool.ruff]\nline-length = 100\n', '/py/m.py': 'x=1\n' }, onPath: { ruff: '/bin/ruff' }, format: rewrite })
  expect((await session.edit('/py/m.py')).context?.join(' ')).toContain('with ruff')
  expect(session.started().at(-1)).toEqual(['/bin/ruff', 'format', '-q', '/py/m.py'])
})

test('auto-format: black runs with [tool.black]', async ($, on) => {
  const session = probe($, on, { files: { '/bk/pyproject.toml': '[tool.black]\n', '/bk/m.py': 'x=1\n' }, onPath: { black: '/bin/black' }, format: rewrite })
  expect((await session.edit('/bk/m.py')).context?.join(' ')).toContain('with black')
  expect(session.started().at(-1)).toEqual(['/bin/black', '-q', '/bk/m.py'])
})

test('auto-format: ruff.toml opts in', async ($, on) => {
  const session = probe($, on, { files: { '/py/ruff.toml': '', '/py/m.py': 'x=1\n' }, onPath: { ruff: '/bin/ruff' }, format: rewrite })
  expect((await session.edit('/py/m.py')).context?.join(' ')).toContain('with ruff')
})

test('auto-format: gofmt runs with go.mod', async ($, on) => {
  const session = probe($, on, { files: { '/go/go.mod': 'module x\n', '/go/m.go': 'package x\n' }, onPath: { gofmt: '/bin/gofmt' }, format: rewrite })
  expect((await session.edit('/go/m.go')).context?.join(' ')).toContain('with gofmt')
  expect(session.started().at(-1)).toEqual(['/bin/gofmt', '-w', '/go/m.go'])
})

test('auto-format: rustfmt runs with Cargo.toml', async ($, on) => {
  const session = probe($, on, { files: { '/rs/Cargo.toml': '', '/rs/src/m.rs': 'fn main(){}\n' }, onPath: { rustfmt: '/bin/rustfmt' }, format: rewrite })
  expect((await session.edit('/rs/src/m.rs')).context?.join(' ')).toContain('with rustfmt')
  expect(session.started().at(-1)).toEqual(['/bin/rustfmt', '--edition', '2021', '/rs/src/m.rs'])
})

test('auto-format: unknown extension and missing file stay silent', async ($, on) => {
  const session = probe($, on, { files: { ...PRETTIER_PROJECT, '/proj/notes.txt': 'hi\n' }, format: rewrite })
  expect((await session.edit('/proj/notes.txt')).context ?? []).toEqual([])
  expect((await session.edit('/proj/src/nope.ts')).context ?? []).toEqual([])
  expect(session.started()).toEqual([])
})

test('auto-format: a formatter failure is reported with a scrubbed message and the file is left alone', async ($, on) => {
  const session = probe($, on, {
    files: { ...PRETTIER_PROJECT, '/proj/src/c.ts': 'const z=3\n' },
    format: () => ({ exitCode: 2, stderr: `syntax error near ${FAKE.github}` }),
  })
  const note = ((await session.edit('/proj/src/c.ts')).context ?? []).join(' ')
  expect(note).toMatch(/auto-format: prettier failed on \/proj\/src\/c\.ts \(exit 2\)/)
  expect(note).toContain('[REDACTED]')
  expect(note).not.toContain(FAKE.github)
  expect(note).toContain('File left as written.')
  expect(session.files().get('/proj/src/c.ts')).toBe('const z=3\n')
})

const deep = (levels: number) => `/${Array.from({ length: levels }, (_, i) => `d${i}`).join('/')}/a.ts`

test('auto-format: a config 11 directories up is found', async ($, on) => {
  const session = probe($, on, { files: { '/.prettierrc': '{}', '/node_modules/.bin/prettier': 'b', [deep(11)]: 'x' }, format: rewrite })
  expect((await session.edit(deep(11))).context?.join(' ')).toContain('with prettier')
})

test('auto-format: the config search stops after 12 directories', async ($, on) => {
  const session = probe($, on, { files: { '/.prettierrc': '{}', '/node_modules/.bin/prettier': 'b', [deep(12)]: 'x' }, format: rewrite })
  expect((await session.edit(deep(12))).context ?? []).toEqual([])
})

test('auto-format: an Edit is formatted too, a Bash command is not', async ($, on) => {
  const session = probe($, on, { files: PRETTIER_PROJECT, format: rewrite })
  const edited = await $.tool.call({ tool: 'Edit', file_path: '/proj/src/a.ts', old_string: 'x', new_string: 'y' })
  expect(edited.context?.join(' ')).toContain('reformatted')
  await session.bash('ls')
  expect(session.started().length).toBe(1)
})
