import { expect, test } from 'claude-code/testing'

import { HOUR, SURFACES, TODAY_KEY, TOMORROW_KEY, probe } from './probe'

// Money is compared in whole cents: 3 + 0.3 is not exactly 3.3.
const cents = (value: unknown): number => Math.round(Number(value) * 100)

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface)
  const text = (await ui.find({ key: 'daily-spend' }))?.text
  await ui.unmount()
  return text
}

test('daily-spend: adds the turn cost to the total other sessions kept today', async ($, on) => {
  const session = probe($, on, { usd: 1 }, { [TODAY_KEY]: 3 })
  await session.turn({ usd: 1.3 })
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('today $3.30')
  expect(cents(session.writes()[TODAY_KEY])).toBe(330)

  await session.turn({ usd: 1.5 })
  expect(await read(session)).toBe('today $3.50')
  expect(cents(session.writes()[TODAY_KEY])).toBe(350)
})

test('daily-spend: a turn that ends twice is added once', async ($, on) => {
  const session = probe($, on, { usd: 1 }, { [TODAY_KEY]: 3 })
  await session.turn({ usd: 1.3 })
  await session.complete({ usd: 1.3 })
  expect(cents(session.writes()[TODAY_KEY])).toBe(330)
})

test('daily-spend: a turn with no known start adds nothing the first time', async ($, on) => {
  const session = probe($, on, {}, { [TODAY_KEY]: 3 })
  await session.complete({ usd: 40 })
  expect(await read(session)).toBe('today $3.00')
  expect(session.writes()).toEqual({})

  await session.complete({ usd: 40.5 })
  expect(cents(session.writes()[TODAY_KEY])).toBe(350)
})

test('daily-spend: a new local day starts a new total and keeps the old one', async ($, on) => {
  const session = probe($, on, { usd: 1 }, { [TODAY_KEY]: 3 })
  await session.turn({ usd: 1.3 })
  await session.advance(13 * HOUR)
  expect(await read(session)).toBeUndefined()

  await session.turn({ usd: 1.6 })
  expect(await read(session)).toBe('today $0.30')
  expect(cents(session.writes()[TOMORROW_KEY])).toBe(30)
  expect(cents(session.writes()[TODAY_KEY])).toBe(330)
})

test('daily-spend: hides while nothing is known today, and when the cost is absent', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 20 })
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
  expect(session.writes()).toEqual({})
})

test('daily-spend: a stored total that is not a number counts as none', async ($, on) => {
  const session = probe($, on, { usd: 1 }, { [TODAY_KEY]: 'lots' })
  await session.turn({ usd: 1.25 })
  expect(await read(session)).toBe('today $0.25')
})
