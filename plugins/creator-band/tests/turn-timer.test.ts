import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const read = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface, 200)
  const found = (await session.segments(ui)).find(item => item.key === 'turn-timer')
  await ui.unmount()
  return found?.text
}

test('turn-timer: hidden before a turn, shown while one runs, hidden after', async ($, on) => {
  const session = probe($, on)
  expect(await read(session)).toBeUndefined()
  await session.begin()
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('turn 0:00')
  await session.advance(42_000)
  for (const surface of SURFACES) expect(await read(session, surface)).toBe('turn 0:42')
  await session.complete({})
  for (const surface of SURFACES) expect(await read(session, surface)).toBeUndefined()
})

test('turn-timer: minutes, and hours once past one', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  await session.advance(12 * 60_000 + 5000)
  expect(await read(session)).toBe('turn 12:05')
  await session.advance(50 * 60_000 + 1000)
  expect(await read(session)).toBe('turn 1:02:06')
})

test('turn-timer: it redraws once a second while the turn runs, and not after', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  const before = session.stateWrites('minute')
  await session.advance(3000)
  expect(session.stateWrites('minute') - before).toBe(3)
  await session.complete({})
  const ended = session.stateWrites('minute')
  await session.advance(10_000)
  expect(session.stateWrites('minute')).toBe(ended)
})

test('turn-timer: a subagent turn ending does not hide it or stop it', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  await session.advance(5000)
  await session.complete({}, { agentId: 'agent-1' })
  await session.advance(2000)
  expect(await read(session)).toBe('turn 0:07')
})

test('turn-timer: a turn end whose usage read fails still hides it', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  session.breakUsage()
  await session.complete({})
  expect(await read(session)).toBeUndefined()
})

test('turn-timer: the next turn starts from zero, and the end of the session stops the tick', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  await session.advance(9000)
  await session.complete({})
  await session.advance(30_000)
  await session.begin()
  expect(await read(session)).toBe('turn 0:00')
  await session.end()
  const ended = session.stateWrites('minute')
  await session.advance(5000)
  expect(session.stateWrites('minute')).toBe(ended)
})

test('turn-timer: drawing never writes state', async ($, on) => {
  const session = probe($, on)
  await session.begin()
  const before = session.stateWrites('turnStartedAt')
  await read(session)
  await read(session, 'desktop')
  expect(session.stateWrites('turnStartedAt')).toBe(before)
})
