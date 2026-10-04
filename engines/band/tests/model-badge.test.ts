import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'model-badge')
  await ui.unmount()
  return found?.text
}

test('model-badge: the model and the context percent, on every surface', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'claude-opus-4-1', percent: 62 })
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('opus-4-1 · 62%')
})

test('model-badge: the percent is rounded', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'claude-sonnet-4', percent: 61.6 })
  expect(await read(session)).toBe('sonnet-4 · 62%')
})

test('model-badge: the date stamp and the 1m tag are dropped', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'claude-opus-4-1-20250805', percent: 5 })
  expect(await read(session)).toBe('opus-4-1 · 5%')
  await session.turn({ model: 'claude-sonnet-4[1m]', percent: 5 })
  expect(await read(session)).toBe('sonnet-4 · 5%')
})

test('model-badge: a name that is not an id is kept as it is', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'Opus 4.1', percent: 5 })
  expect(await read(session)).toBe('Opus 4.1 · 5%')
})

test('model-badge: it follows a model change at the next turn end', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'claude-opus-4-1', percent: 10 })
  await session.turn({ model: 'claude-haiku-4', percent: 11 })
  expect(await read(session)).toBe('haiku-4 · 11%')
})

test('model-badge: with no percent the model shows alone, with no model the percent', async ($, on) => {
  const session = probe($, on)
  await session.turn({ model: 'claude-opus-4-1' })
  expect(await read(session)).toBe('opus-4-1')
  await session.turn({ percent: 40 })
  expect(await read(session)).toBe('40%')
})

test('model-badge: hidden with neither figure', async ($, on) => {
  const session = probe($, on)
  await session.turn({})
  expect(await read(session)).toBeUndefined()
})

test('model-badge: a session that reports no model leaves the percent standing', async ($, on) => {
  const session = probe($, on)
  await session.turn({ percent: 33 })
  expect(await read(session)).toBe('33%')
})
