import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const COUNT = 'grep -I -c -e  -- .'

const COUNTS = [
  'src/a.ts:100',
  'src/b.ts:50',
  'src/c.py:30',
  'package-lock.json:9000',
  'Cargo.lock:400',
  'yarn.lock:12',
  'README.md:20',
  'Makefile:5',
  'x.ts:0',
].join('\n')

const EXPECTED = [
  'Lines of tracked text files: 205 in 5 files',
  '',
  'TypeScript  2 files  150 lines',
  'Python      1 file   30 lines',
  'Markdown    1 file   20 lines',
  'Makefile    1 file   5 lines',
].join('\n')

test('loc: registers /loc with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'loc')?.description).toMatch(/lines/i)
})

test('loc: sums by language, sorted by lines, with a total, skipping lockfiles', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: COUNTS } })
  const text = await session.run('loc')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(text).not.toMatch(/lock|JSON/i)
  expect(session.copied()).toEqual([EXPECTED])
})

test('loc: a file with no known extension is grouped by its extension', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: 'a.zig:7\nb.zig:3\nnotes:2' } })
  await session.run('loc')
  const text = session.copied()[0] ?? ''
  expect(text).toContain('.zig')
  expect(text).toContain('(no extension)')
})

test('loc: ties sort by name', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: 'a.py:5\nb.go:5' } })
  await session.run('loc')
  const text = session.copied()[0] ?? ''
  expect(text.indexOf('Go')).toBeLessThan(text.indexOf('Python'))
})

test('loc: only lockfiles or binaries leaves nothing to count', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: 'package-lock.json:10' } })
  const text = await session.run('loc')
  expect(text).toBe('No tracked text files to count.')
  expect(session.copied()).toEqual([])
})

test('loc: a repo with no tracked files says so', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('loc')).toBe('No tracked text files to count.')
})

test('loc: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('loc')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('loc: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: COUNTS }, truncated: [COUNT] })
  const text = await session.run('loc')
  expect(text).toMatch(/^loc: failed, git grep output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('loc: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [COUNT]: COUNTS } })
  await session.run('loc')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
