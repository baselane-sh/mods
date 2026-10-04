import { expect, test } from 'claude-code/testing'

import { HOUR, NOON, SURFACES, probe } from './probe'

const MINUTE = 60_000
const SEC = 1000

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'session-clock')
  await ui.unmount()
  return found?.text
}

test('session-clock: the wall clock and the session age, on every surface', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON - HOUR - 12 * MINUTE })
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('12:00 · 1h 12m')
})

test('session-clock: both figures move with the clock, with no turn between', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON - 50 * MINUTE })
  expect(await read(session)).toBe('12:00 · 50m')
  await session.advance(15 * MINUTE)
  expect(await read(session)).toBe('12:15 · 1h 5m')
})

test('session-clock: a session under a minute old reads 0m', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON - 20_000 })
  expect(await read(session)).toBe('12:00 · 0m')
})

test('session-clock: a start in the future never reads a negative age', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON + HOUR })
  expect(await read(session)).toBe('12:00 · 0m')
})

test('session-clock: days of age stay in hours', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON - 26 * HOUR })
  expect(await read(session)).toBe('12:00 · 26h 0m')
})

test('session-clock: hidden while the session reports no start', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 10 })
  expect(await read(session)).toBeUndefined()
})

test('session-clock: drawing never writes state', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON - HOUR })
  const before = session.stateWrites('reading')
  await read(session)
  await session.advance(MINUTE)
  await read(session)
  expect(session.stateWrites('reading')).toBe(before)
})

test('session-clock: the band is drawn again on each whole minute while the screen is idle', async ($, on) => {
  const session = probe($, on)
  await session.advance(30 * SEC)
  await session.turn({ startedAt: NOON - 50 * MINUTE })
  // The drawing reads the minute, so the host draws the band again on each write of it.
  const reads = session.stateReads('minute')
  expect(await read(session)).toBe('12:00 · 50m')
  expect(session.stateReads('minute')).toBeGreaterThan(reads)
  await session.advance(29 * SEC)
  expect(session.stateWrites('minute')).toBe(0)
  await session.advance(SEC)
  expect(session.stateWrites('minute')).toBe(1)
  expect(await read(session)).toBe('12:01 · 51m')
  await session.advance(MINUTE)
  expect(session.stateWrites('minute')).toBe(2)
})

test('session-clock: redraws at most once a minute, and only while it shows', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 10 })
  await session.advance(10 * MINUTE)
  expect(session.stateWrites('minute')).toBe(0)
  await session.turn({ startedAt: NOON })
  await session.advance(10 * MINUTE)
  const writes = session.stateWrites('minute')
  expect(writes).toBeGreaterThan(0)
  expect(writes).toBeLessThanOrEqual(10)
  await session.turn({ percent: 10 })
  await session.advance(10 * MINUTE)
  expect(session.stateWrites('minute')).toBe(writes)
})

test('session-clock: the minute tick stops when the session ends', async ($, on) => {
  const session = probe($, on)
  await session.turn({ startedAt: NOON })
  await session.advance(2 * MINUTE)
  expect(session.stateWrites('minute')).toBeGreaterThan(0)
  await session.end()
  const writes = session.stateWrites('minute')
  await session.advance(10 * MINUTE)
  expect(session.stateWrites('minute')).toBe(writes)
})
