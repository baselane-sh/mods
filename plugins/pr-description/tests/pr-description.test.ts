import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const STAT = ' a.ts | 10 ++++++++++\n b.ts |  2 +-\n 2 files changed, 10 insertions(+), 2 deletions(-)\n'

const branch = (name: string, base = 'main') => ({
  ...IN_REPO,
  'rev-parse --abbrev-ref HEAD': `${name}\n`,
  [`rev-parse --verify --quiet ${base}`]: 'abc\n',
  [`merge-base HEAD ${base}`]: 'm1234567890\n',
  [`log m1234567890..HEAD --reverse --no-merges --format=%s`]: 'Add login form\nWire up auth\n',
  'diff --stat m1234567890 HEAD': STAT,
})

const EXPECTED = [
  'Title: feat: add login',
  'Base: main (merge base m123456)',
  '',
  '## Summary',
  '- Add login form',
  '- Wire up auth',
  '',
  '## Changes',
  '2 files changed, 10 insertions(+), 2 deletions(-)',
  '',
  '## Test plan',
  '- [ ] Automated tests pass',
  '- [ ] Main flow checked by hand',
  '- [ ] Edge cases and error paths checked',
].join('\n')

test('pr-description: registers /pr-description with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'pr-description')?.description).toMatch(/pull request|PR/i)
})

test('pr-description: title, summary, diff totals and a test plan against main', async ($, on) => {
  const session = probe($, on, { git: branch('feat/add-login') })
  const text = await session.run('pr-description')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
  expect(text).toMatch(/copied to clipboard/)
})

test('pr-description: falls back to master when there is no main', async ($, on) => {
  const session = probe($, on, { git: branch('feat/add-login', 'master') })
  await session.run('pr-description')
  expect(session.copied()[0]).toContain('Base: master (merge base m123456)')
})

test('pr-description: main wins when both main and master exist', async ($, on) => {
  const git = { ...branch('feat/add-login'), 'rev-parse --verify --quiet master': 'def\n' }
  const session = probe($, on, { git })
  await session.run('pr-description')
  expect(session.copied()[0]).toContain('Base: main (merge base m123456)')
})

test('pr-description: a branch name without a type becomes a plain sentence', async ($, on) => {
  const session = probe($, on, { git: branch('fix-bug_42') })
  await session.run('pr-description')
  expect(session.copied()[0]).toMatch(/^Title: Fix bug 42\n/)
})

test('pr-description: an unknown prefix such as a user name is dropped', async ($, on) => {
  const session = probe($, on, { git: branch('mohammad/add-login') })
  await session.run('pr-description')
  expect(session.copied()[0]).toMatch(/^Title: Add login\n/)
})

test('pr-description: a detached HEAD takes the title from the first commit', async ($, on) => {
  const session = probe($, on, { git: branch('HEAD') })
  await session.run('pr-description')
  expect(session.copied()[0]).toMatch(/^Title: Add login form\n/)
})

test('pr-description: no commits ahead of the base says so', async ($, on) => {
  const git = { ...branch('feat/x'), 'log m1234567890..HEAD --reverse --no-merges --format=%s': '' }
  const session = probe($, on, { git })
  const text = await session.run('pr-description')
  expect(text).toMatch(/^Branch feat\/x has no commits ahead of main\. Nothing to describe\./)
  expect(session.copied()).toEqual([])
})

test('pr-description: no main or master says there is no base', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'rev-parse --abbrev-ref HEAD': 'feat/x\n' } })
  const text = await session.run('pr-description')
  expect(text).toMatch(/^No main or master branch found, so there is no base to compare against\./)
})

test('pr-description: an empty diff reads as no file changes', async ($, on) => {
  const session = probe($, on, { git: { ...branch('feat/x'), 'diff --stat m1234567890 HEAD': '' } })
  await session.run('pr-description')
  expect(session.copied()[0]).toContain('## Changes\nNo file changes')
})

test('pr-description: outside a git repo it says so and copies nothing', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('pr-description')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('pr-description: no credential reaches the text or the clipboard', async ($, on) => {
  const git = { ...branch('feat/x'), 'log m1234567890..HEAD --reverse --no-merges --format=%s': `leak ${FAKE.github}\n` }
  const session = probe($, on, { git })
  const text = await session.run('pr-description')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
  expect(text).toContain('[REDACTED]')
})

test('pr-description: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: branch('feat/add-login') })
  await session.run('pr-description')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
