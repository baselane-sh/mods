import { expect, test } from 'claude-code/testing'

import { FAKE, IN_REPO } from './fixtures'
import { probe } from './probe'

const GREP = 'grep -I -n -w -e TODO -e FIXME -e HACK -- .'

const HITS = [
  'src/a.ts:12:  // TODO: handle empty input',
  'src/a.ts:40:  // FIXME broken on windows',
  'README.md:3:HACK around the proxy',
].join('\n')

const EXPECTED = [
  'TODO, FIXME and HACK: 3 in 2 files',
  '',
  'src/a.ts',
  '  12: // TODO: handle empty input',
  '  40: // FIXME broken on windows',
  '',
  'README.md',
  '  3: HACK around the proxy',
].join('\n')

test('todos: registers /todos with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'todos')?.description).toMatch(/TODO/)
})

test('todos: groups lines by file in git grep order', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: `${HITS}\n` } })
  const text = await session.run('todos')
  expect(text.startsWith(EXPECTED)).toBe(true)
  expect(session.copied()).toEqual([EXPECTED])
})

test('todos: caps at 50 lines and counts the rest', async ($, on) => {
  const many = Array.from({ length: 53 }, (_, i) => `f${i % 3}.ts:${i + 1}:// TODO ${i}`).join('\n')
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: many } })
  await session.run('todos')
  const text = session.copied()[0] ?? ''
  expect(text.split('\n').filter(l => l.includes('// TODO ')).length).toBe(50)
  expect(text).toContain('+3 more')
  expect(text).toContain('TODO, FIXME and HACK: 53 in 3 files')
  expect(text).not.toContain('// TODO 52')
})

test('todos: exactly 50 lines has no more line', async ($, on) => {
  const fifty = Array.from({ length: 50 }, (_, i) => `a.ts:${i + 1}:// TODO ${i}`).join('\n')
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: fifty } })
  await session.run('todos')
  expect(session.copied()[0] ?? '').not.toMatch(/more/)
})

test('todos: a long line is shortened', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: `a.ts:1:// TODO ${'x'.repeat(300)}` } })
  await session.run('todos')
  const row = (session.copied()[0] ?? '').split('\n').find(l => l.startsWith('  1: ')) ?? ''
  expect(row.length).toBeLessThanOrEqual(120)
  expect(row.endsWith('...')).toBe(true)
})

test('todos: no match says so and copies nothing', async ($, on) => {
  const session = probe($, on, { git: IN_REPO })
  const text = await session.run('todos')
  expect(text).toBe('No TODO, FIXME or HACK lines in tracked files.')
  expect(session.copied()).toEqual([])
})

test('todos: outside a git repo it says so', async ($, on) => {
  const session = probe($, on, { cwd: '/tmp/plain' })
  const text = await session.run('todos')
  expect(text).toMatch(/^Not a git repository: \/tmp\/plain/)
  expect(session.copied()).toEqual([])
})

test('todos: output cut at the cap is reported, not half read', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: HITS }, truncated: [GREP] })
  const text = await session.run('todos')
  expect(text).toMatch(/^todos: failed, git grep output passed the 4 MiB cap/)
  expect(session.copied()).toEqual([])
})

test('todos: no credential reaches the text', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: `a.ts:1:// TODO ${FAKE.github}` } })
  const text = await session.run('todos')
  expect(text + session.copied().join('')).not.toContain(FAKE.github)
})

test('todos: the text has no em-dashes', async ($, on) => {
  const session = probe($, on, { git: { ...IN_REPO, [GREP]: HITS } })
  await session.run('todos')
  expect(session.copied()[0] ?? '').not.toContain('\u2014')
})
