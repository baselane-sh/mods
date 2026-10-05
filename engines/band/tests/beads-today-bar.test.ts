import { expect, test } from 'claude-code/testing'

import { KEYS, REAL, bdCalls, bdTimeouts, fakeBd, json, segmentOf } from './bd-fixtures'
import { HOUR, NOON, SURFACES, probe } from './probe'

const MINUTE = 60_000

const ID = 'beads-today-bar'
const found = (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => segmentOf(session, ID, surface)
const TODAY = KEYS.today('2026-10-04')
const withToday = (count: number) => fakeBd({ ...REAL, [TODAY]: json({ count, schema_version: 1 }) })

test('beads-today-bar: beads closed since local midnight against the default goal of 5', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  for (const surface of SURFACES) expect((await found(session, surface))?.text).toBe('today ▮▮▮▯▯ 3/5')
  expect((await found(session))?.color).toBeUndefined()
  // A bare date: bd reads it as local midnight and counts what closed after it.
  expect(bdCalls(session, TODAY)[0]).toEqual(['bd', 'count', '--closed-after', '2026-10-04', '--json'])
})

test('beads-today-bar: none closed yet still shows the goal', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withToday(0))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('today ▯▯▯▯▯ 0/5')
})

test('beads-today-bar: green when the goal is met', { options: { dailyGoal: 3 } }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  const shown = await found(session)
  expect(shown?.text).toBe('today ▮▮▮ 3/3')
  expect(shown?.color).toBe('green')
  session.setCommand('bd', withToday(7))
  await session.bash('bd close bm-1')
  expect((await found(session))?.text).toBe('today ▮▮▮ 7/3')
})

test('beads-today-bar: a goal above 10 draws 10 cells', { options: { dailyGoal: 20 } }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('today ▮▮▯▯▯▯▯▯▯▯ 3/20')
})

test('beads-today-bar: the lowest goal is 1', { options: { dailyGoal: 1 } }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('today ▮ 3/1')
})

test('beads-today-bar: the highest goal of 50 draws 10 cells', { options: { dailyGoal: 50 } }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('today ▮▯▯▯▯▯▯▯▯▯ 3/50')
})

test('beads-today-bar: at local midnight it asks for the new day and never draws yesterday as today', async ($, on) => {
  // 23:50 local time on 2026-10-04.
  const session = probe($, on, {}, {}, NOON + 12 * HOUR - 10 * MINUTE)
  const next = KEYS.today('2026-10-05')
  session.setCommand('bd', fakeBd({ ...REAL, [next]: { ...json({ count: 1 }), delayMs: 10 * MINUTE } }))
  await session.turn({})
  expect((await found(session))?.text).toBe('today ▮▮▮▯▯ 3/5')
  // 23:59: still the 4th.
  await session.advance(9 * MINUTE)
  expect((await found(session))?.text).toBe('today ▮▮▮▯▯ 3/5')
  expect(bdCalls(session, next)).toEqual([])
  // Past midnight: the read for the 5th is under way, the 4th's figure is not drawn.
  await session.advance(2 * MINUTE)
  expect(bdCalls(session, next).length).toBe(1)
  expect(await found(session)).toBeUndefined()
  await session.advance(10 * MINUTE)
  expect((await found(session))?.text).toBe('today ▮▯▯▯▯ 1/5')
})

test('beads-today-bar: no beads project or bad output shows nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [TODAY]: { exitCode: 1 } }))
  await session.start()
  await session.settle()
  expect(await found(session)).toBeUndefined()
  for (const reply of [{ stdout: '' }, { stdout: 'not json' }, { stdout: '[]' }, json({ count: -1 }), json({ count: '3' })]) {
    session.setCommand('bd', fakeBd({ ...REAL, [TODAY]: reply }))
    await session.bash('ls')
    expect(await found(session)).toBeUndefined()
  }
})

test('beads-today-bar: without bd it shows nothing and logs once', async ($, on) => {
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

test('beads-today-bar: at most one read every two minutes with a 10 s timeout, and one after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(bdCalls(session, TODAY).length).toBe(1)
  await session.advance(119_000)
  expect(bdCalls(session, TODAY).length).toBe(1)
  await session.advance(1000)
  expect(bdCalls(session, TODAY).length).toBe(2)
  await session.bash('ls')
  expect(bdCalls(session, TODAY).length).toBe(3)
  expect(bdTimeouts(session, TODAY)).toEqual([10_000, 10_000, 10_000])
})
