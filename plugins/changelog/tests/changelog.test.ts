import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const SINCE_TAG = 'log v1.2.0..HEAD --no-merges --format=%h %s'
const LAST_30 = 'log -30 --no-merges --format=%h %s'

const COMMITS = [
  'a1 feat(ui): add dark mode',
  'b2 fix: stop crash on empty input',
  'c3 docs: update readme',
  'd4 refactor(core)!: split parser',
  'e5 test: cover parser',
  'f6 chore(deps): bump x',
  'g7 perf: faster lookup',
  'h8 feat: second feature',
  'i9 Tidy things up',
].join('\n')

const EXPECTED = [
  '## Changelog since v1.2.0',
  '',
  '### Features',
  '- **ui:** add dark mode (a1)',
  '- second feature (h8)',
  '',
  '### Fixes',
  '- stop crash on empty input (b2)',
  '',
  '### Documentation',
  '- update readme (c3)',
  '',
  '### Refactoring',
  '- **core:** BREAKING: split parser (d4)',
  '',
  '### Tests',
  '- cover parser (e5)',
  '',
  '### Chores',
  '- **deps:** bump x (f6)',
  '',
  '### Other',
  '- perf: faster lookup (g7)',
  '- Tidy things up (i9)',
].join('\n')

test('changelog: registers /changelog with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'changelog')?.description).toMatch(/changelog/i)
})

test('changelog: groups commits since the last tag by conventional type', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'describe --tags --abbrev=0': 'v1.2.0\n', [SINCE_TAG]: COMMITS } })
  const text = await session.run('changelog')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
  expect(text).toMatch(/copied to clipboard/)
})

test('changelog: with no tag it takes the last 30 commits', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LAST_30]: 'a1 fix: one\nb2 feat: two\n' } })
  await session.run('changelog')
  expect(session.copied()[0]).toBe(
    ['## Changelog (last 30 commits, no tag)', '', '### Features', '- two (b2)', '', '### Fixes', '- one (a1)'].join('\n'),
  )
})

test('changelog: a tag with no commits after it says so', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'describe --tags --abbrev=0': 'v1.2.0\n', [SINCE_TAG]: '' } })
  const text = await session.run('changelog')
  expect(text).toBe('No commits since v1.2.0.')
  expect(session.copied()).toEqual([])
})

test('changelog: a repo with no commits at all says so', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  const text = await session.run('changelog')
  expect(text).toBe('No commits found.')
  expect(session.copied()).toEqual([])
})

test('changelog: outside a git repo it says so and copies nothing', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('changelog')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
  expect(session.ran()).toEqual(['git -C /tmp/plain rev-parse --is-inside-work-tree'])
})

test('changelog: a type in capitals still groups, and a subject keeps its colon', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LAST_30]: 'a1 FEAT: Loud\nb2 fix: handle a: b\n' } })
  await session.run('changelog')
  const text = session.copied()[0] ?? ''
  expect(text).toContain('### Features\n- Loud (a1)')
  expect(text).toContain('- handle a: b (b2)')
})

test('changelog: no credential reaches the text or the clipboard', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [LAST_30]: `a1 fix: leak ${FAKE.github}\n` } })
  const text = await session.run('changelog')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
  expect(text).toContain('[REDACTED]')
})

test('changelog: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'describe --tags --abbrev=0': 'v1.2.0\n', [SINCE_TAG]: COMMITS } })
  await session.run('changelog')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
