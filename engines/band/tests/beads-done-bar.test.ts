import { expect, test } from 'claude-code/testing'

import { KEYS, REAL, STATUS, bdCalls, bdTimeouts, fakeBd, json, segmentOf } from './bd-fixtures'
import { SURFACES, probe } from './probe'

const ID = 'beads-done-bar'
const found = (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => segmentOf(session, ID, surface)

const withCounts = (closed: number, total: number) =>
  fakeBd({ ...REAL, [KEYS.status]: json({ ...STATUS, summary: { ...STATUS.summary, closed_issues: closed, total_issues: total } }) })

test('beads-done-bar: closed of all as a 10 cell bar and a percent', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  // 1354 of 1531 is 88.4%.
  for (const surface of SURFACES) expect((await found(session, surface))?.text).toBe('beads █████████░ 88%')
  expect((await found(session))?.color).toBeUndefined()
  expect(bdCalls(session, KEYS.status)[0]).toEqual(['bd', 'status', '--json'])
})

test('beads-done-bar: full and green only when every bead is closed', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withCounts(999, 1000))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('beads █████████░ 99%')
  session.setCommand('bd', withCounts(1000, 1000))
  await session.bash('bd close bm-1')
  const done = await found(session)
  expect(done?.text).toBe('beads ██████████ 100%')
  expect(done?.color).toBe('green')
  session.setCommand('bd', withCounts(0, 3))
  await session.bash('ls')
  expect((await found(session))?.text).toBe('beads ░░░░░░░░░░ 0%')
})

test('beads-done-bar: no beads, no beads project or bad output shows nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withCounts(0, 0))
  await session.start()
  await session.settle()
  expect(await found(session)).toBeUndefined()
  for (const reply of [{ exitCode: 1 }, { stdout: '' }, { stdout: 'not json' }, { stdout: '[]' }, json({ summary: { closed_issues: '3', total_issues: 4 } })]) {
    session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: reply }))
    await session.bash('ls')
    expect(await found(session)).toBeUndefined()
  }
})

test('beads-done-bar: without bd it shows nothing and logs once', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(await found(session)).toBeDefined()
  session.setCommand('bd', 'reject')
  await session.advance(120_000)
  await session.advance(120_000)
  expect(await found(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes(`${ID} `)).length).toBe(1)
})

test('beads-done-bar: at most one read every two minutes with a 10 s timeout, and one after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  const first = bdCalls(session, KEYS.status).length
  expect(first).toBeGreaterThan(0)
  await session.advance(119_000)
  expect(bdCalls(session, KEYS.status).length).toBe(first)
  await session.advance(1000)
  expect(bdCalls(session, KEYS.status).length).toBeGreaterThan(first)
  const timed = bdCalls(session, KEYS.status).length
  await session.bash('ls')
  expect(bdCalls(session, KEYS.status).length).toBeGreaterThan(timed)
  expect(new Set(bdTimeouts(session, KEYS.status))).toEqual(new Set([10_000]))
})
