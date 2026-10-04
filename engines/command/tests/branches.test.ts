import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const DAY = 86_400
const ago = (days: number): number => Math.floor(Date.now() / 1000) - days * DAY

const HEAD = 'symbolic-ref --quiet --short refs/remotes/origin/HEAD'
const VERIFY_MAIN = 'rev-parse --verify --quiet main'
const CURRENT = 'rev-parse --abbrev-ref HEAD'
const REFS = 'for-each-ref refs/heads --format=%(refname:short) %(committerdate:unix)'
const MERGED = 'branch --merged main --format=%(refname:short)'

const repo = (refs: Readonly<Record<string, number>>, merged: readonly string[], extra: Readonly<Record<string, string>> = {}) => ({
  git: {
    ...IN_REPO,
    [VERIFY_MAIN]: 'abc\n',
    [CURRENT]: 'main\n',
    [REFS]: Object.entries(refs).map(([name, at]) => `${name} ${at}`).join('\n'),
    [MERGED]: merged.join('\n'),
    ...extra,
  },
})

test('branches: registers /branches with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'branches')?.description).toMatch(/never deletes/i)
})

test('branches: lists merged and stale branches, never the default or current one', async ($, on) => {
  const session = probe($, on, repo(
    { main: ago(1), 'feat/done': ago(5), 'feat/old': ago(60), 'feat/live': ago(2), 'feat/here': ago(90) },
    ['main', 'feat/done', 'feat/here'],
    { [CURRENT]: 'feat/here\n' },
  ))
  const text = await session.run('branches')
  expect(text).toContain('Merged into main (1)\n- feat/done')
  expect(text).toContain('No commit in 30 days (1)\n- feat/old (60 days ago)')
  expect(text).not.toContain('feat/live')
  expect(text).not.toMatch(/- main|feat\/here/)
  expect(text).toMatch(/Nothing was deleted/)
  expect(session.copied()[0]).toContain('Nothing was deleted')
})

test('branches: a merged stale branch is listed once, under merged', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), 'feat/x': ago(100) }, ['feat/x']))
  const text = await session.run('branches')
  expect(text.match(/feat\/x/g)?.length).toBe(1)
  expect(text).not.toContain('No commit in 30 days')
})

test('branches: a branch 29 days old is not stale, 31 days is', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), a: ago(29), b: ago(31) }, []))
  const text = await session.run('branches')
  expect(text).toContain('- b (31 days ago)')
  expect(text).not.toMatch(/- a /)
})

test('branches: origin/HEAD names the default branch', async ($, on) => {
  const session = probe($, on, {
    git: {
      ...IN_REPO,
      [HEAD]: 'origin/develop\n',
      'rev-parse --verify --quiet develop': 'abc\n',
      [CURRENT]: 'develop\n',
      [REFS]: `develop ${ago(1)}\nfeat/z ${ago(2)}`,
      'branch --merged develop --format=%(refname:short)': 'feat/z\n',
    },
  })
  expect(await session.run('branches')).toContain('Merged into develop (1)\n- feat/z')
})

test('branches: master is the fallback when main is absent', async ($, on) => {
  const session = probe($, on, {
    git: {
      ...IN_REPO,
      'rev-parse --verify --quiet master': 'abc\n',
      [CURRENT]: 'master\n',
      [REFS]: `master ${ago(1)}\nold ${ago(1)}`,
      'branch --merged master --format=%(refname:short)': 'old\n',
    },
  })
  expect(await session.run('branches')).toContain('Merged into master (1)')
})

test('branches: a clean repo says there is nothing to clean up', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), live: ago(1) }, ['main']))
  const text = await session.run('branches')
  expect(text).toBe('Nothing to clean up: no merged or stale branches besides main.')
  expect(session.copied()).toEqual([])
})

test('branches: an empty repo (no branches) says so', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [REFS]: '' } })
  expect(await session.run('branches')).toBe('No local branches yet.')
})

test('branches: no main or master says so', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [REFS]: `trunk ${ago(1)}` } })
  expect(await session.run('branches')).toMatch(/^No main or master branch found/)
})

test('branches: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  expect(await session.run('branches')).toMatch(/^Not a git repository: \/tmp\/plain/)
})

test('branches: output cut at the cap is reported', async ($, on) => {
  const session = probe($, on, { ...repo({ main: ago(1) }, []), truncated: [REFS] })
  expect(await session.run('branches')).toMatch(/^branches: failed, git for-each-ref output passed the 4 MiB cap/)
})

test('branches: it only reads, never runs a delete or a write command', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), 'feat/old': ago(60) }, ['feat/old']))
  await session.run('branches')
  expect(session.ran().filter(c => /branch (-d|-D|--delete)|push|update-ref/.test(c))).toEqual([])
  expect(session.written()).toEqual({})
})

test('branches: no credential reaches the text', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), [`x-${FAKE.github}`]: ago(60) }, []))
  const text = await session.run('branches')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('branches: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, repo({ main: ago(1), old: ago(60) }, []))
  const text = await session.run('branches')
  expect(text).not.toContain('\u2014')
})
