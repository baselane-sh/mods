import { expect, test } from 'claude-code/testing'

import { HOUR, NOON, SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'streak-flame')
  await ui.unmount()
  return found?.text
}

// The probe's clock stands at 2026-10-04 12:00 local.
const TODAY = '2026-10-04'

test('streak-flame: a first turn starts a streak of one day', async ($, on) => {
  const session = probe($, on)
  await session.turn({})
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('🔥 1d')
  expect(session.writes().streak).toEqual({ last: TODAY, days: 1 })
})

test('streak-flame: yesterday last meant the streak goes on', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: '2026-10-03', days: 4 } })
  await session.turn({})
  expect(await read(session)).toBe('🔥 5d')
  expect(session.writes().streak).toEqual({ last: TODAY, days: 5 })
})

test('streak-flame: a second turn the same day changes and writes nothing', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: TODAY, days: 5 } })
  await session.turn({})
  await session.turn({})
  expect(await read(session)).toBe('🔥 5d')
  expect(session.writes()).toEqual({})
})

test('streak-flame: a missed day starts over at one', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: '2026-10-02', days: 9 } })
  await session.turn({})
  expect(await read(session)).toBe('🔥 1d')
  expect(session.writes().streak).toEqual({ last: TODAY, days: 1 })
})

// A local noon on a calendar day: month ends, a year end and a leap day.
const noonOf = (y: number, m: number, d: number): number => new Date(y, m - 1, d, 12).getTime()

const NEXT_DAYS: readonly (readonly [string, number, number, number])[] = [
  ['2026-10-31', 2026, 11, 1],
  ['2026-12-31', 2027, 1, 1],
  ['2028-02-28', 2028, 2, 29],
  ['2028-02-29', 2028, 3, 1],
]

for (const [last, y, m, d] of NEXT_DAYS) {
  test(`streak-flame: ${y}-${m}-${d} follows ${last}`, async ($, on) => {
    const session = probe($, on, {}, { streak: { last, days: 2 } })
    await session.advance(noonOf(y, m, d) - NOON)
    await session.turn({})
    expect(await read(session)).toBe('🔥 3d')
  })
}

test('streak-flame: it counts across midnight into the next day', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: TODAY, days: 5 } })
  await session.turn({})
  await session.advance(13 * HOUR)
  // The band still shows the streak until a turn ends: yesterday's last day is alive.
  expect(await read(session)).toBe('🔥 5d')
  await session.turn({})
  expect(await read(session)).toBe('🔥 6d')
  expect(session.writes().streak).toEqual({ last: '2026-10-05', days: 6 })
})

test('streak-flame: a streak that ended two days ago is not drawn', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: TODAY, days: 5 } })
  await session.turn({})
  await session.advance(48 * HOUR)
  expect(await read(session)).toBeUndefined()
})

const NOT_STREAKS: readonly unknown[] = ['5', null, { last: 'yesterday', days: 3 }, { last: TODAY, days: 0 }, { last: TODAY, days: 1.5 }, { last: TODAY }, []]
NOT_STREAKS.forEach((bad, at) => {
  test(`streak-flame: a record that is not a streak is ignored (${at})`, async ($, on) => {
    const session = probe($, on, {}, { streak: bad })
    await session.turn({})
    expect(await read(session)).toBe('🔥 1d')
  })
})

test('streak-flame: a clock that went back keeps the streak', async ($, on) => {
  const session = probe($, on, {}, { streak: { last: '2026-10-09', days: 7 } })
  await session.turn({})
  expect(await read(session)).toBeUndefined()
  expect(session.writes()).toEqual({})
})

test('streak-flame: a subagent turn does not move it', async ($, on) => {
  const session = probe($, on)
  await session.complete({}, { agentId: 'agent-1' })
  expect(session.writes()).toEqual({})
  expect(await read(session)).toBeUndefined()
})
