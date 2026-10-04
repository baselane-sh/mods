import { expect, test } from 'claude-code/testing'

import { redact } from '../hooks/patterns'
import { EMPTY, observe } from '../hooks/tracker'
import { FAKE } from './fixtures'
import { DENY_WORD, FAIL_WORD, probe } from './probe'

test('tracker: counts tools, unique files, commands, blocked and errored', () => {
  const calls = [
    [{ tool: 'Bash', command: 'npm test' }, {}],
    [{ tool: 'Bash', command: 'ls' }, {}],
    [{ tool: 'Write', file_path: '/a.ts' }, {}],
    [{ tool: 'Edit', file_path: '/a.ts' }, {}],
    [{ tool: 'Edit', file_path: '/b.ts' }, {}],
    [{ tool: 'Read', file_path: '/c.ts' }, {}],
    [{ tool: 'Bash', command: 'rm -rf x' }, { deny: 'no' }],
    [{ tool: 'Bash', command: 'false' }, { isError: true }],
  ] as const
  const record = calls.reduce((so_far, [e, ran]) => observe(so_far, e, ran), EMPTY)
  expect(record.calls).toBe(8)
  expect(record.tools).toEqual({ Bash: 4, Write: 1, Edit: 2, Read: 1 })
  expect([...record.files].sort()).toEqual(['/a.ts', '/b.ts'])
  expect(record.commands).toEqual(['npm test', 'ls', 'false'])
  expect(record.commandsRun).toBe(3)
  expect(record.blocked).toBe(1)
  expect(record.errored).toBe(1)
})

test('tracker: observe never changes the record it was given', () => {
  const before = JSON.stringify(EMPTY)
  observe(EMPTY, { tool: 'Bash', command: 'ls' }, {})
  expect(JSON.stringify(EMPTY)).toBe(before)
})

test('tracker: a denied write is not a touched file', () => {
  const record = observe(EMPTY, { tool: 'Write', file_path: '/a.ts' }, { deny: 'no' })
  expect(record.files).toEqual([])
  expect(record.blocked).toBe(1)
})

test('tracker: credential shapes are redacted in commands and paths', () => {
  const withCommand = observe(EMPTY, { tool: 'Bash', command: `curl -H "Authorization: ${FAKE.github}" x` }, {})
  const withPath = observe(EMPTY, { tool: 'Write', file_path: `/tmp/${FAKE.anthropic}.txt` }, {})
  const kept = JSON.stringify([withCommand, withPath])
  for (const secret of [FAKE.github, FAKE.anthropic]) expect(kept).not.toContain(secret)
  expect(kept).toContain('[REDACTED]')
})

test('tracker: the command list is capped and each command is short', () => {
  let record = EMPTY
  for (let i = 0; i < 300; i += 1) record = observe(record, { tool: 'Bash', command: `echo ${i} ${'x'.repeat(500)}` }, {})
  expect(record.commands.length).toBe(200)
  expect(record.commandsRun).toBe(300)
  expect(record.commands.every(command => command.length <= 200)).toBe(true)
  expect(record.commands.at(-1)?.startsWith('echo 299')).toBe(true)
})

test('engine: the session record lands in state, redacted', async ($, on) => {
  const session = probe($, on)
  await session.bash(`echo ${FAKE.postgres}`)
  await session.bash(`${DENY_WORD} now`)
  await session.bash(`${FAIL_WORD} now`)
  await session.write('/repo/a.ts')
  const value = session.recorded()
  expect(value?.calls).toBe(4)
  expect(value?.blocked).toBe(1)
  expect(value?.errored).toBe(1)
  expect(value?.files).toEqual(['/repo/a.ts'])
  expect(JSON.stringify(value)).not.toContain(FAKE.postgres)
})

test('engine: a /clear starts the record over', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await $.session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  expect(session.recorded()?.calls ?? 0).toBe(0)
})

test('engine: session.start registers every rule as a slash command', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().length).toBeGreaterThan(0)
  expect(session.registered().every(c => c.name.length > 0 && c.description.length > 0)).toBe(true)
})

// Spliced so this file does not match the shape it carries.
const URL_CREDENTIAL = 'https://user:' + 'tok3n@git.example.com/org/lib.git'

test('patterns: a URL that carries a user and a password is redacted', () => {
  expect(redact(`clone ${URL_CREDENTIAL} now`)).toBe('clone [REDACTED]git.example.com/org/lib.git now')
  expect(redact('git+' + 'https://gitlab-ci-token:' + 'abc123@gitlab.com/x.git')).not.toContain('abc123')
})

test('patterns: URLs with no credentials are left alone', () => {
  for (const url of [
    'https://example.com/path?q=1',
    'https://example.com:8443/path',
    'ssh://git@github.com/org/repo.git',
    'http://localhost:3000/@scope/pkg',
    'https://example.com/a:b@c',
    'mailto:ada@example.com',
  ]) expect(redact(url)).toBe(url)
})
