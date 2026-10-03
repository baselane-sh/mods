import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const text = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number]) => {
  const ui = await session.mount(surface)
  const found = (await ui.find({ key: 'latte-meter' }))?.text
  await ui.unmount()
  return found
}

test('latte-meter: the default price is 5.0', async ($, on) => {
  const session = probe($, on)
  await session.turn({ usd: 12 })
  for (const surface of SURFACES) expect(await text(session, surface)).toBe('2.4 lattes')
})

test('latte-meter: lattePrice sets the price', { options: { lattePrice: 4 } }, async ($, on) => {
  const session = probe($, on)
  await session.turn({ usd: 12 })
  for (const surface of SURFACES) expect(await text(session, surface)).toBe('3.0 lattes')
})

test('latte-meter: a price that cannot divide falls back to the default', { options: { lattePrice: 0 } }, async ($, on) => {
  const session = probe($, on)
  await session.turn({ usd: 12 })
  expect(await text(session, 'terminal')).toBe('2.4 lattes')
})

test('latte-meter: exactly one reads singular', async ($, on) => {
  const session = probe($, on)
  await session.turn({ usd: 5 })
  expect(await text(session, 'terminal')).toBe('1.0 latte')
})

test('latte-meter: hides when the cost is absent', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 10 })
  for (const surface of SURFACES) expect(await text(session, surface)).toBeUndefined()
})
