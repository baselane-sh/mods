import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const SHORTLOG = 'shortlog -sn --no-merges HEAD'
const LOG = 'log --no-merges --format=%aN%x09%as'

const repo = (shortlog: string, log: string) => ({ git: { ...IN_REPO, [SHORTLOG]: shortlog, [LOG]: log } })

const SHORT = '    42\tAda Lovelace\n     7\tGrace Hopper\n     1\tAlan Turing\n'
const DATES = 'Grace Hopper\t2026-09-30\nAda Lovelace\t2026-09-12\nAda Lovelace\t2026-01-02\nAlan Turing\t2025-12-25\n'

const EXPECTED = [
  'Contributors by commits: 3 people, 50 commits',
  '',
  '42 commits  Ada Lovelace  (last 2026-09-12)',
  '7 commits  Grace Hopper  (last 2026-09-30)',
  '1 commit  Alan Turing  (last 2025-12-25)',
].join('\n')

test('authors: registers /authors with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'authors')?.description).toMatch(/commit/i)
})

test('authors: commit counts with each last commit date', async ($, on) => {
  const session = probe($, on, repo(SHORT, DATES))
  const text = await session.run('authors')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
})

test('authors: shows the top 15 and counts the rest', async ($, on) => {
  const short = Array.from({ length: 18 }, (_, i) => `${100 - i}\tPerson ${i}`).join('\n')
  const log = Array.from({ length: 18 }, (_, i) => `Person ${i}\t2026-01-01`).join('\n')
  const session = probe($, on, repo(short, log))
  await session.run('authors')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => l.includes('Person ')).length).toBe(15)
  expect(text).toContain('+3 more')
  expect(text).toContain('18 people')
  expect(text).not.toContain('Person 15')
})

test('authors: exactly 15 people has no more line', async ($, on) => {
  const short = Array.from({ length: 15 }, (_, i) => `${100 - i}\tPerson ${i}`).join('\n')
  const session = probe($, on, repo(short, ''))
  await session.run('authors')
  expect(session.copied()[0] ?? '').not.toMatch(/more/)
})

test('authors: never an email address, even in a name', async ($, on) => {
  const short = `5\tEve <eve@example.com>\n3\tbob@corp.io\n`
  const log = `Eve <eve@example.com>\t2026-02-02\nbob@corp.io\t2026-02-01\n`
  const session = probe($, on, repo(short, log))
  const text = await session.run('authors')
  expect(text + session.copied().join('')).not.toContain('@')
  expect(text).toContain('Eve')
  expect(session.ran().some(c => c.includes('%ae') || c.includes('%aE') || c.includes('%an <'))).toBe(false)
})

test('authors: an author with no dated commit shows an unknown date', async ($, on) => {
  const session = probe($, on, repo('2\tZed\n', ''))
  const text = await session.run('authors')
  expect(text).toContain('2 commits  Zed  (last unknown)')
})

test('authors: an empty repo says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  const text = await session.run('authors')
  expect(text).toBe('No commits yet.')
  expect(session.copied()).toEqual([])
})

test('authors: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('authors')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('authors: output cut at the cap is reported, not half read', async ($, on) => {
  const session = probe($, on, { ...repo(SHORT, DATES), truncated: [LOG] })
  const text = await session.run('authors')
  expect(text).toMatch(/^authors: failed, git log output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('authors: no credential reaches the text', async ($, on) => {
  const session = probe($, on, repo(`4\t${FAKE.github}\n`, ''))
  const text = await session.run('authors')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('authors: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, repo(SHORT, DATES))
  await session.run('authors')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
