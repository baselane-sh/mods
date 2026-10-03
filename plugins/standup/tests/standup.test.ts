import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { DENY_WORD, FAIL_WORD, probe } from './probe'

const EMAIL = 'me@example.com'
const LOG = `log --since=yesterday --author=${EMAIL} --no-merges --format=%h %s`

const repo = (log: string) => ({ ...IN_REPO, 'config user.email': `${EMAIL}\n`, [LOG]: log })

const busySession = async (session: ReturnType<typeof probe>) => {
  await session.bash('npm test')
  await session.bash('ls')
  await session.edit('/repo/a.ts')
  await session.write('/repo/b.ts')
  await session.bash(`${DENY_WORD} rm`)
  await session.bash(`${FAIL_WORD} x`)
}

const FULL = [
  'Yesterday',
  '- abc1234 Fix login redirect',
  '- def5678 Add retry',
  '',
  'Today',
  '- Files touched (2):',
  '  - /repo/a.ts',
  '  - /repo/b.ts',
  '- Commands run (3):',
  '  - npm test',
  '  - ls',
  '  - FAILME x',
  '',
  'Blockers',
  '- 1 tool call blocked by a hook',
  '- 1 tool call ended in an error',
].join('\n')

test('standup: registers /standup with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'standup')?.description).toMatch(/standup/i)
})

test('standup: Yesterday from git log, Today and Blockers from the session', async ($, on) => {
  const session = probe($, on, { git: repo('abc1234 Fix login redirect\ndef5678 Add retry\n') })
  await busySession(session)
  const text = await session.run('standup')
  expect(text.startsWith(FULL)).toBe(true)
  expect(session.copied()).toEqual([FULL])
  expect(text).toMatch(/copied to clipboard/)
})

test('standup: asks git for the author email and the commits since yesterday', async ($, on) => {
  const session = probe($, on, { git: repo('abc1234 x\n') })
  await session.run('standup')
  expect(session.ran()).toContain('git -C /repo config user.email')
  expect(session.ran()).toContain(`git -C /repo ${LOG}`)
})

test('standup: an empty day and an empty session read as nothing, not as blanks', async ($, on) => {
  const session = probe($, on, { git: repo('') })
  await session.run('standup')
  const text = session.copied()[0] ?? ''
  expect(text).toContain(`- Nothing committed since yesterday by ${EMAIL}`)
  expect(text).toContain('- Nothing recorded in this session yet')
  expect(text).toMatch(/Blockers\n- None$/)
})

test('standup: outside a git repo it says so and still reports the session', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  await session.bash('ls')
  const text = await session.run('standup')
  expect(text).toContain('- Not a git repository: /tmp/plain, so no commits to list')
  expect(text).toContain('Commands run (1):')
})

test('standup: without a git user.email it says so and does not guess', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  const text = await session.run('standup')
  expect(text).toContain('- git user.email is not set, so commits cannot be listed')
  expect(session.ran().some(argv => argv.includes('--author'))).toBe(false)
})

test('standup: no credential reaches the text or the clipboard', async ($, on) => {
  const session = probe($, on, { git: repo(`abc1234 rotate ${FAKE.github}\n`) })
  await session.bash(`echo ${FAKE.anthropic}`)
  const text = await session.run('standup')
  const everything = text + session.copied().join('')
  for (const secret of [FAKE.github, FAKE.anthropic]) expect(everything).not.toContain(secret)
  expect(everything).toContain('[REDACTED]')
})

test('standup: long lists are cut with a count', async ($, on) => {
  const session = probe($, on, { git: repo('') })
  for (let i = 1; i <= 12; i += 1) await session.write(`/repo/f${i}.ts`)
  for (let i = 1; i <= 8; i += 1) await session.bash(`echo ${i}`)
  await session.run('standup')
  const text = session.copied()[0] ?? ''
  expect(text).toContain('- Files touched (12):')
  expect(text).toContain('  - and 2 more')
  expect(text).toContain('- Commands run (8):')
  expect(text).toContain('  - and 3 more earlier')
  expect(text).toContain('  - echo 8')
  expect(text).not.toContain('  - echo 3\n')
})

test('standup: a git that is cut off at the cap is reported, not half read', async ($, on) => {
  const session = probe($, on, { git: repo('abc x\n'), truncated: [LOG] })
  const text = await session.run('standup')
  expect(text).toMatch(/^standup: failed, git log output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('standup: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: repo('abc1234 Fix\n') })
  await busySession(session)
  await session.run('standup')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
