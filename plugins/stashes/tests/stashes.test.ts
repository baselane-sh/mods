import { expect, test } from 'claude-code/testing'

import { IN_REPO } from './fixtures'
import { probe } from './probe'

const LIST = 'stash list --format=%gd%x09%cr%x09%gs'
const stashes = (...rows: string[]) => ({ git: { ...IN_REPO, [LIST]: rows.join('\n') + '\n' } })

test('stashes: registers /stashes with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'stashes')?.description).toMatch(/stash/i)
})

test('stashes: age and branch for a WIP stash and a named one', async ($, on) => {
  const session = probe($, on, stashes('stash@{0}\t2 days ago\tWIP on main: abc1234 fix login', 'stash@{1}\t3 weeks ago\tOn feat/x: half done'))
  const text = await session.run('stashes')
  expect(text.startsWith(['Stashes: 2', '', '- stash@{0}  2 days ago  main  abc1234 fix login', '- stash@{1}  3 weeks ago  feat/x  half done'].join('\n'))).toBe(true)
})

test('stashes: a subject git did not write keeps its text with an unknown branch', async ($, on) => {
  const session = probe($, on, stashes('stash@{0}\t1 hour ago\tcustom subject'))
  expect(await session.run('stashes')).toContain('stash@{0}  1 hour ago  unknown branch  custom subject')
})

test('stashes: no stashes says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LIST]: '' } })
  expect(await session.run('stashes')).toBe('No stashes.')
  expect(session.copied()).toEqual([])
})

test('stashes: an empty repo (git fails) says no stashes', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  expect(await session.run('stashes')).toBe('No stashes.')
})

test('stashes: lists 30 and counts the rest', async ($, on) => {
  const rows = Array.from({ length: 33 }, (_, i) => `stash@{${i}}\t1 day ago\tWIP on main: s${i}`)
  const session = probe($, on, stashes(...rows))
  const text = await session.run('stashes')
  expect(text).toContain('Stashes: 33')
  expect(text).toContain('and 3 more')
  expect(text).not.toContain('stash@{30}')
})

test('stashes: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('stashes')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('stashes: only reads (never apply or drop) and has no em-dashes', async ($, on) => {
  const session = probe($, on, stashes('stash@{0}\t1 day ago\tWIP on main: x'))
  await session.run('stashes')
  expect(session.ran().some(c => /stash (apply|pop|drop|clear|push|save)/.test(c))).toBe(false)
  expect(session.copied()[0] ?? '').not.toContain('—')
  expect(session.written()).toEqual({})
})
