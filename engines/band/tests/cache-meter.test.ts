import { expect, test } from 'claude-code/testing'

import { NOON, SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'cache-meter')
  await ui.unmount()
  return found?.text
}

test('cache-meter: the share of prompt tokens the cache served', async ($, on) => {
  const session = probe($, on)
  await session.complete({}, { usage: { input: 100, cacheRead: 700, cacheWrite: 200 } })
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('cache 70%')
})

test('cache-meter: it adds up over the session', async ($, on) => {
  const session = probe($, on)
  await session.complete({}, { usage: { input: 0, cacheRead: 0, cacheWrite: 1000 } })
  expect(await read(session)).toBe('cache 0%')
  await session.complete({}, { usage: { input: 0, cacheRead: 1000, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 50%')
  await session.complete({}, { usage: { input: 0, cacheRead: 2000, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 75%')
})

test('cache-meter: a turn with no usage keeps the figure, and none before one has usage', async ($, on) => {
  const session = probe($, on)
  await session.complete({ usd: 1 })
  expect(await read(session)).toBeUndefined()
  await session.complete({ usd: 1 }, { usage: { input: 10, cacheRead: 30, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 75%')
  await session.complete({ usd: 2 })
  expect(await read(session)).toBe('cache 75%')
})

test('cache-meter: a subagent turn is not counted', async ($, on) => {
  const session = probe($, on)
  await session.complete({}, { usage: { input: 10, cacheRead: 30, cacheWrite: 0 } })
  await session.complete({}, { agentId: 'agent-1', usage: { input: 1000, cacheRead: 0, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 75%')
})

test('cache-meter: a new session (a new start time) starts the sum over', async ($, on) => {
  const session = probe($, on)
  await session.complete({ startedAt: NOON - 1000 }, { usage: { input: 0, cacheRead: 100, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 100%')
  await session.complete({ startedAt: NOON }, { usage: { input: 100, cacheRead: 0, cacheWrite: 0 } })
  expect(await read(session)).toBe('cache 0%')
})

test('cache-meter: an all-zero turn draws nothing and never divides by zero', async ($, on) => {
  const session = probe($, on)
  await session.complete({}, { usage: { input: 0, cacheRead: 0, cacheWrite: 0 } })
  expect(await read(session)).toBeUndefined()
})

test('cache-meter: usage is read from the turn, so a broken session usage read leaves it out', async ($, on) => {
  const session = probe($, on)
  session.breakUsage()
  await session.complete({}, { usage: { input: 10, cacheRead: 30, cacheWrite: 0 } })
  expect(await read(session)).toBeUndefined()
})
