import { expect, test } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

const MIN = 60_000
const SEC = 1000

const shown = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => {
  const ui = await session.mount(surface)
  const found = (await ui.find({ key: 'pomodoro' }))?.text
  await ui.unmount()
  return found
}

test('pomodoro: registers /pomodoro when the session starts', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('pomodoro')
})

test('pomodoro: hidden until it is started', async ($, on) => {
  const session = probe($, on)
  await session.start()
  for (const surface of SURFACES) expect(await shown(session, surface)).toBeUndefined()
})

test('pomodoro: /pomodoro starts a 25 minute focus, before any turn has ended', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(await session.run('pomodoro')).toContain('started')
  for (const surface of SURFACES) expect(await shown(session, surface)).toBe('focus 25:00')
})

test('pomodoro: counts down as the clock moves', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  await session.advance(6 * MIN + 18 * SEC)
  expect(await shown(session)).toBe('focus 18:42')
})

test('pomodoro: switches to a 5 minute break with a toast, then back to focus with a toast', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  await session.advance(25 * MIN - SEC)
  expect(session.toasts()).toEqual([])
  expect(await shown(session)).toBe('focus 00:01')

  await session.advance(SEC)
  expect(await shown(session)).toBe('break 05:00')
  expect(session.toasts().length).toBe(1)
  expect(session.toasts()[0]).toMatch(/break/i)

  await session.advance(1 * MIN + 50 * SEC)
  expect(await shown(session)).toBe('break 03:10')

  await session.advance(3 * MIN + 10 * SEC)
  expect(await shown(session)).toBe('focus 25:00')
  expect(session.toasts().length).toBe(2)
  expect(session.toasts()[1]).toMatch(/focus/i)
})

test('pomodoro: a second /pomodoro stops it, and nothing ticks after', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  await session.advance(10 * SEC)
  expect(await session.run('pomodoro')).toContain('stopped')
  expect(await shown(session)).toBeUndefined()
  const writes = session.stateWrites('pomodoro')
  await session.advance(30 * MIN)
  expect(session.stateWrites('pomodoro')).toBe(writes)
  expect(session.toasts()).toEqual([])
})

test('pomodoro: it starts again after a stop', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  await session.advance(5 * MIN)
  await session.run('pomodoro')
  await session.run('pomodoro')
  expect(await shown(session)).toBe('focus 25:00')
})

test('pomodoro: redraws at most once per second', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  const before = session.stateWrites('pomodoro')
  await session.advance(10 * SEC)
  const writes = session.stateWrites('pomodoro') - before
  expect(writes).toBeGreaterThan(0)
  expect(writes).toBeLessThanOrEqual(10)
})

test('pomodoro: a turn end does not wipe the timer', async ($, on) => {
  const session = probe($, on)
  await session.run('pomodoro')
  await session.turn({ usd: 1, percent: 10 })
  expect(await shown(session)).toBe('focus 25:00')
})
