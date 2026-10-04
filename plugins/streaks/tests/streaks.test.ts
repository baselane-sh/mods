import { expect, test } from 'claude-code/testing'

import { addDays } from '../hooks/date'
import { HOUR, TODAY, activeDays, at, back, day, probe } from './probe'

// In a pack the other mods toast too: look at the streak's own.
const streakToasts = (session: ReturnType<typeof probe>) => session.toasts().filter(t => t.startsWith('Day '))

test('streaks: registers /streak with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('streak')
})

test('streaks: the first day says Day 1', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(streakToasts(session)).toEqual(['Day 1 streak'])
})

test('streaks: four straight days behind today make today Day 5', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(1, 4)) } })
  await session.start()
  expect(streakToasts(session)).toEqual(['Day 5 streak'])
  expect(await session.run('streak')).toMatch(/^Day 5 streak/)
})

test('streaks: a turn today does not change the number, and no second toast shows', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(1, 4)) } })
  await session.start()
  await session.turn()
  expect(streakToasts(session)).toEqual(['Day 5 streak'])
  expect(await session.run('streak')).toMatch(/^Day 5 streak/)
})

test('streaks: a later session on a day that already had a turn says the same day', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays([TODAY, ...back(1, 3)]) } })
  await session.start()
  expect(streakToasts(session)).toEqual(['Day 4 streak'])
})

test('streaks: a missed day resets to Day 1', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(2, 5)) } })
  await session.start()
  expect(streakToasts(session)).toEqual(['Day 1 streak'])
  expect(await session.run('streak')).toMatch(/^Day 1 streak/)
})

test('streaks: a session with no turn does not count as a day', async ($, on) => {
  const days = { ...activeDays(back(2, 3)), [addDays(TODAY, -1)]: day({ sessions: 1 }) }
  const session = probe($, on, { store: { days } })
  await session.start()
  expect(streakToasts(session)).toEqual(['Day 1 streak'])
})

test('streaks: counts through real days, then resets after a gap', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 12) })
  await session.start()
  await session.turn()
  await session.advance(24 * HOUR)
  await session.start()
  await session.turn()
  await session.advance(24 * HOUR)
  await session.start()
  expect(streakToasts(session).at(-1)).toBe('Day 3 streak')
  await session.turn()
  await session.advance(48 * HOUR)
  await session.start()
  expect(streakToasts(session).at(-1)).toBe('Day 1 streak')
})

test('streaks: /streak reports the best streak and the last 14 days', async ($, on) => {
  const days = activeDays([...back(1, 3), ...back(5, 9)])
  const session = probe($, on, { store: { days } })
  await session.turn()
  const text = await session.run('streak')
  expect(text).toMatch(/^Day 4 streak/)
  expect(text).toMatch(/best 9 days/)
  // Oldest on the left, today on the right.
  expect(text.split('\n').find(line => line.startsWith('last 14 days'))).toBe('last 14 days  #########.####')
})

test('streaks: /streak is printed, not copied', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.run('streak')
  expect(session.copied()).toEqual([])
})

test('streaks: with nothing today the answer says how to keep it', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(1, 2)) } })
  await session.start()
  expect(await session.run('streak')).toMatch(/Send a prompt today/)
})

test('streaks: no em-dashes', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(1, 2)) } })
  await session.start()
  expect(`${session.toasts().join('')}${await session.run('streak')}`).not.toContain(String.fromCharCode(0x2014))
})
