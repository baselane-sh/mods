import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const NAME = 'config user.name'
// The name exactly, then the address: never a longer name that holds it.
const LOG = 'log --branches --source --basic-regexp --author=^Ada Lovelace < -n 15 --format=%as%x09%h%x09%S%x09%s'
const repo = (log: string) => ({ git: { ...IN_REPO, [NAME]: 'Ada Lovelace\n', [LOG]: log } })

test('recent: registers /recent with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'recent')?.description).toMatch(/last 15 commits/i)
})

test('recent: date, hash, branch and subject, newest first', async ($, on) => {
  const session = probe($, on, repo('2026-09-30\tabc1234\trefs/heads/main\tfix login\n2026-09-28\tdef5678\trefs/heads/feat/x\tadd form\n'))
  const text = await session.run('recent')
  expect(text.startsWith(['Your last 2 commits on local branches (Ada Lovelace)', '', '2026-09-30  abc1234  main  fix login', '2026-09-28  def5678  feat/x  add form'].join('\n'))).toBe(true)
  expect(session.copied().length).toBe(1)
})

test('recent: asks git for 15 commits whose author is exactly the configured name', async ($, on) => {
  const session = probe($, on, repo('2026-01-01\ta\trefs/heads/main\ts\n'))
  await session.run('recent')
  expect(session.ran()).toContain(`git -C /repo ${LOG}`)
})

test('recent: no user.name explains and copies nothing', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('recent')).toBe('git user.name is not set, so there is no author to match.')
  expect(session.copied()).toEqual([])
})

test('recent: no commits by you says so', async ($, on) => {
  const session = probe($, on, repo('\n'))
  expect(await session.run('recent')).toBe('No commits by Ada Lovelace on local branches.')
})

test('recent: an empty repo says no commits yet', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [NAME]: 'Ada Lovelace\n' } })
  expect(await session.run('recent')).toBe('No commits yet.')
})

test('recent: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('recent')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('recent: no credential reaches the text', async ($, on) => {
  const session = probe($, on, repo(`2026-01-01\ta\trefs/heads/main\trotate ${FAKE.github}\n`))
  const text = await session.run('recent')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('recent: only reads, and the text has no em-dashes', async ($, on) => {
  const session = probe($, on, repo('2026-01-01\ta\trefs/heads/main\ts\n'))
  await session.run('recent')
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})

test('recent: a name holding pattern characters is matched as text', async ($, on) => {
  const log = 'log --branches --source --basic-regexp --author=^J\\. \\[Dev\\]\\* (x)\\$ < -n 15 --format=%as%x09%h%x09%S%x09%s'
  const session = probe($, on, { git: { ...IN_REPO, [NAME]: 'J. [Dev]* (x)$\n', [log]: '2026-01-01\ta\trefs/heads/main\ts\n' } })
  const text = await session.run('recent')
  expect(text).toContain('Your last 1 commits on local branches (J. [Dev]* (x)$)')
})
