import { expect, test } from 'claude-code/testing'

import { bead, json, NO_PROJECT_ERR } from './bd-fixtures'
import { probe } from './probe'

const KEY = 'bd ready --json -n 0'
const ONE_LINE = (text: string) => expect(text.split('\n')).toHaveLength(1)

test('ready: registers /ready with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'ready')?.description).toMatch(/ready beads/i)
})

test('ready: one line per bead, by priority then oldest, with the count', async ($, on) => {
  const rows = [
    bead('bm-c', { priority: 2, created_at: '2026-09-01T00:00:00Z' }),
    bead('bm-b', { priority: 1, created_at: '2026-10-02T00:00:00Z' }),
    bead('bm-a', { priority: 1, created_at: '2026-10-01T00:00:00Z' }),
    bead('bm-z', { priority: 0, created_at: '2026-10-03T00:00:00Z' }),
  ]
  const session = probe($, on, { git: { [KEY]: json(rows) } })
  const text = await session.run('ready')
  expect(text).toBe(['bm-z  P0  Title of bm-z', 'bm-a  P1  Title of bm-a', 'bm-b  P1  Title of bm-b', 'bm-c  P2  Title of bm-c', '4 ready'].join('\n'))
})

test('ready: more than 20 shows the top 20 and "20 of N ready"', async ($, on) => {
  const rows = Array.from({ length: 97 }, (_, i) => bead(`bm-${i}`, { priority: i % 3 }))
  const session = probe($, on, { git: { [KEY]: json(rows) } })
  const lines = (await session.run('ready')).split('\n')
  expect(lines).toHaveLength(21)
  expect(lines[20]).toBe('20 of 97 ready')
})

test('ready: copies nothing and does not say it copied', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-a')]) } })
  const text = await session.run('ready')
  expect(session.copied()).toEqual([])
  expect(text).not.toMatch(/copied/)
})

test('ready: asks bd only, with an argv and no shell', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '[]' } })
  await session.run('ready')
  expect(session.ran()).toEqual([KEY])
})

test('ready: an empty list says 0 ready', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '[]' } })
  expect(await session.run('ready')).toBe('0 ready')
})

test('ready: a long title is cut to one line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-a', { title: `${'x'.repeat(200)}\nsecond line` })]) } })
  const first = (await session.run('ready')).split('\n')[0] ?? ''
  expect(first.length).toBeLessThan(100)
  expect(first.endsWith('…')).toBe(true)
})

test('ready: bd missing prints "bd is not installed."', async ($, on) => {
  const session = probe($, on, { missing: [KEY] })
  expect(await session.run('ready')).toBe('bd is not installed.')
})

test('ready: exit 1 outside a beads folder prints the no-project line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '' }, exit: { [KEY]: 1 }, stderr: { [KEY]: NO_PROJECT_ERR } })
  const text = await session.run('ready')
  expect(text).toBe('No beads project in this folder.')
  ONE_LINE(text)
})

test('ready: JSON that does not parse prints "bd did not answer."', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: 'not json' } })
  expect(await session.run('ready')).toBe('bd did not answer.')
})

test('ready: JSON that is not a list prints "bd did not answer."', async ($, on) => {
  expect(await probe($, on, { git: { [KEY]: '{"a":1}' } }).run('ready')).toBe('bd did not answer.')
})

test('ready: a timeout prints "bd did not answer."', async ($, on) => {
  const session = probe($, on, { timeout: [KEY] })
  expect(await session.run('ready')).toBe('bd did not answer.')
})

test('ready: exit 1 with another reason is a failure, not "no project"', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '' }, exit: { [KEY]: 1 }, stderr: { [KEY]: 'Error: database is locked' } })
  expect(await session.run('ready')).toBe('bd did not answer.')
})

test('ready: exit 1 with nothing on stderr counts as no beads project', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '' }, exit: { [KEY]: 1 } })
  expect(await session.run('ready')).toBe('No beads project in this folder.')
})
