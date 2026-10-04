import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const LOG = 'log --since=90 days ago --no-merges --name-only --format='

const names = (counts: Readonly<Record<string, number>>): string =>
  Object.entries(counts)
    .flatMap(([file, n]) => Array.from({ length: n }, () => file))
    .join('\n\n')

test('hotspots: registers /hotspots with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'hotspots')?.description).toMatch(/90 days/)
})

test('hotspots: ranks files by change count', async ($, on) => {
  const log = names({ 'src/a.ts': 5, 'src/b.ts': 9, 'README.md': 2 })
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: log } })
  const text = await session.run('hotspots')
  const expected = ['Most changed files in the last 90 days', '', '9  src/b.ts', '5  src/a.ts', '2  README.md'].join('\n')
  expect(text.startsWith(expected)).toBe(true)
  expect(session.copied()).toEqual([expected])
})

test('hotspots: lists 10 files at most, ties by name', async ($, on) => {
  const counts = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${String(i).padStart(2, '0')}.ts`, 3]))
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: names(counts) } })
  await session.run('hotspots')
  const rows = (session.copied()[0] ?? '').split('\n').filter(l => l.includes('.ts'))
  expect(rows.length).toBe(10)
  expect(rows[0]).toBe('3  f00.ts')
  expect(rows[9]).toBe('3  f09.ts')
})

test('hotspots: no commits in the window says so', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: '\n' } })
  const text = await session.run('hotspots')
  expect(text).toBe('No file changes in the last 90 days.')
  expect(session.copied()).toEqual([])
})

test('hotspots: an empty repo (git log fails) says so', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('hotspots')).toBe('No file changes in the last 90 days.')
})

test('hotspots: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('hotspots')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('hotspots: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: 'a.ts' }, truncated: [LOG] })
  const text = await session.run('hotspots')
  expect(text).toMatch(/^hotspots: failed, git log output passed the 4 MiB cap/)
})

test('hotspots: no credential reaches the text', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: `${FAKE.github}.txt` } })
  const text = await session.run('hotspots')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('hotspots: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LOG]: 'a.ts' } })
  await session.run('hotspots')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
