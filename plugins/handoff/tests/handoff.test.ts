import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { DENY_WORD, FAIL_WORD, probe } from './probe'

const FIRST = '/repo/.claude/handoff.md'

const busySession = async (session: ReturnType<typeof probe>) => {
  await session.bash('npm test')
  await session.edit('/repo/a.ts')
  await session.write('/repo/b.ts')
  await session.bash(`${DENY_WORD} rm`)
  await session.bash(`${FAIL_WORD} x`)
}

const FILE = [
  '# Session handoff',
  '',
  '## What changed',
  '- /repo/a.ts',
  '- /repo/b.ts',
  '',
  'Git status (short):',
  '```text',
  ' M a.ts',
  '?? b.ts',
  '```',
  '',
  '## Commands run',
  '- npm test',
  '- FAILME x',
  '',
  '## Blocked calls',
  '- 1 tool call blocked by a hook',
  '- 1 tool call ended in an error',
  '',
  '## Open questions',
  '- (add the questions for the next session here)',
  '',
].join('\n')

test('handoff: registers /handoff with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'handoff')?.description).toMatch(/handoff/i)
})

test('handoff: writes the summary to .claude/handoff.md and answers with the path', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'status --short': ' M a.ts\n?? b.ts\n' } })
  await busySession(session)
  const text = await session.run('handoff')
  expect(session.written()).toEqual({ [FIRST]: FILE })
  expect(text.startsWith(`Handoff written: ${FIRST}`)).toBe(true)
  expect(session.copied()).toEqual([`Handoff written: ${FIRST}`])
})

test('handoff: never overwrites, it says so and takes the next free number', async ($, on) => {
  const session = probe($, on, { files: [FIRST] })
  const text = await session.run('handoff')
  expect(Object.keys(session.written())).toEqual(['/repo/.claude/handoff-1.md'])
  expect(text).toContain('Handoff written: /repo/.claude/handoff-1.md')
  expect(text).toContain('/repo/.claude/handoff.md already exists and was left as it was.')
})

test('handoff: skips every number that is taken', async ($, on) => {
  const session = probe($, on, { files: [FIRST, '/repo/.claude/handoff-1.md', '/repo/.claude/handoff-2.md'] })
  await session.run('handoff')
  expect(Object.keys(session.written())).toEqual(['/repo/.claude/handoff-3.md'])
})

test('handoff: uses the session working directory', async ($, on) => {
  const session = probe($, on, { cwd: '/work/app' })
  const text = await session.run('handoff')
  expect(Object.keys(session.written())).toEqual(['/work/app/.claude/handoff.md'])
  expect(text).toContain('Handoff written: /work/app/.claude/handoff.md')
})

test('handoff: outside a git repo it still writes and says so in the answer and the file', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  await session.bash('ls')
  const text = await session.run('handoff')
  const file = session.written()['/tmp/plain/.claude/handoff.md'] ?? ''
  expect(text).toContain('Not a git repository: /tmp/plain, so the handoff has no git status.')
  expect(file).toContain('Git: not a git repository, so there is no git status.')
  expect(file).not.toContain('Git status (short)')
})

test('handoff: an empty session reads as nothing, not as blanks', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'status --short': '' } })
  await session.run('handoff')
  const file = session.written()[FIRST] ?? ''
  expect(file).toContain('## What changed\nNo files were written or edited in this session.')
  expect(file).toContain('Git status (short): clean')
  expect(file).toContain('## Commands run\nNone.')
  expect(file).toContain('## Blocked calls\nNone.')
})

test('handoff: no credential reaches the file, the answer or the clipboard', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'status --short': `?? ${FAKE.github}.txt\n` } })
  await session.bash(`echo ${FAKE.anthropic}`)
  const text = await session.run('handoff')
  const everything = text + session.copied().join('') + Object.values(session.written()).join('')
  for (const secret of [FAKE.github, FAKE.anthropic]) expect(everything).not.toContain(secret)
  expect(everything).toContain('[REDACTED]')
})

test('handoff: a failed write is reported, nothing is copied', async ($, on) => {
  const session = probe($, on, { writeFails: true })
  const text = await session.run('handoff')
  expect(text).toMatch(/^handoff: failed, /)
  expect(session.copied()).toEqual([])
})

test('handoff: the file and the answer have no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, 'status --short': ' M a.ts\n' } })
  await busySession(session)
  const text = await session.run('handoff')
  expect(text + Object.values(session.written()).join('')).not.toContain('\u2014')
})
