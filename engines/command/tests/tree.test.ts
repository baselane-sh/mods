import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const LS = 'ls-files'

const FILES = [
  'README.md',
  'package.json',
  'src/a.ts',
  'src/b.ts',
  'src/util/deep.ts',
  'src/util/more/deeper.ts',
  'docs/guide.md',
].join('\n')

const EXPECTED = [
  'Tracked files: 7',
  '',
  'docs/ (1 file)',
  '  guide.md',
  'src/ (4 files)',
  '  util/ (2 files)',
  '  a.ts',
  '  b.ts',
  'README.md',
  'package.json',
].join('\n')

test('tree: registers /tree with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'tree')?.description).toMatch(/tree/i)
})

test('tree: depth 2, folders with file counts, folders before files', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: `${FILES}\n` } })
  const text = await session.run('tree')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
})

test('tree: nothing deeper than depth 2 is listed', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: FILES } })
  const text = await session.run('tree')
  expect(text).not.toContain('deep.ts')
  expect(text).not.toContain('deeper.ts')
})

test('tree: a single file and a singular count', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: 'a/b.txt' } })
  const text = await session.run('tree')
  expect(text).toBe('Tracked files: 1\n\na/ (1 file)\n  b.txt\n\ncopied to clipboard')
})

test('tree: caps at 80 lines and counts the rest', async ($, on) => {
  const many = Array.from({ length: 120 }, (_, i) => `file${String(i).padStart(3, '0')}.txt`).join('\n')
  const session = probe($, on, { git: { ...IN_REPO, [LS]: many } })
  await session.run('tree')
  const out = (session.copied()[0] ?? '').split('\n')
  expect(out.filter(l => l.startsWith('file')).length).toBe(77)
  expect(out[out.length - 1]).toBe('+43 more')
  expect(out.length).toBe(80)
  expect(out).toContain('Tracked files: 120')
})

test('tree: exactly 80 lines has no more line', async ($, on) => {
  const exact = Array.from({ length: 78 }, (_, i) => `f${String(i).padStart(2, '0')}.txt`).join('\n')
  const session = probe($, on, { git: { ...IN_REPO, [LS]: exact } })
  await session.run('tree')
  const out = (session.copied()[0] ?? '').split('\n')
  expect(out.length).toBe(80)
  expect(out.join('\n')).not.toMatch(/more/)
})

test('tree: an empty repo says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: '' } })
  const text = await session.run('tree')
  expect(text).toBe('No tracked files.')
  expect(session.copied()).toEqual([])
})

test('tree: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('tree')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('tree: output cut at the cap is reported, not half read', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: FILES }, truncated: [LS] })
  const text = await session.run('tree')
  expect(text).toMatch(/^tree: failed, git ls-files output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('tree: no credential reaches the text', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: `${FAKE.github}.txt` } })
  const text = await session.run('tree')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('tree: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LS]: FILES } })
  await session.run('tree')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
  expect(session.ran().every(c => /^git -C \/repo (ls-files|rev-parse)/.test(c))).toBe(true)
})
