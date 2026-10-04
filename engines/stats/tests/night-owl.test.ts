import { expect, test } from 'claude-code/testing'

import { HOUR, at, probe } from './probe'

const hours = (session: ReturnType<typeof probe>) => session.stored()['hours'] as number[] | undefined

// A histogram store with `counts` at the given hours and zero elsewhere.
const seeded = (counts: Readonly<Record<number, number>>): number[] => Array.from({ length: 24 }, (_, hour) => counts[hour] ?? 0)

test('night-owl: registers /hours', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('hours')
})

test('night-owl: a turn records the hour of its prompt', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 23, 30) })
  await session.turn()
  expect(hours(session)).toEqual(seeded({ 23: 1 }))
})

test('night-owl: the prompt hour is the turn end less its length, so a long turn keeps the hour it began in', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 5, 0, 10) })
  await session.turn(undefined, 20 * 60_000)
  expect(hours(session)).toEqual(seeded({ 23: 1 }))
})

test('night-owl: hours add up across sessions and days', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 9, 30), store: { hours: seeded({ 9: 4, 22: 1 }) } })
  await session.turn()
  await session.advance(13 * HOUR)
  await session.turn()
  expect(hours(session)).toEqual(seeded({ 9: 5, 22: 2 }))
})

test('night-owl: a subagent turn and a repeated turn end do not count', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 14, 30) })
  await session.complete('t1')
  await session.complete('t1')
  await session.complete('t2', { agentId: 'agent-1' })
  expect(hours(session)).toEqual(seeded({ 14: 1 }))
})

test('night-owl: a session start alone records no prompt', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(hours(session)).toBeUndefined()
})

test('night-owl: /hours draws 24 rows, oldest hour first, and names the peak hour', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 0: 1, 9: 4, 10: 8, 23: 2 }) } })
  const text = await session.run('hours')
  const lines = text.split('\n')
  expect(lines[0]).toBe('Prompts by hour, local time (15 prompts)')
  expect(lines).toHaveLength(26)
  expect(lines[1]).toBe(`00  ${'#'.repeat(3).padEnd(20)}  1`)
  expect(lines[2]).toBe(`01  ${' '.repeat(20)}  0`)
  expect(lines[10]).toBe(`09  ${'#'.repeat(10).padEnd(20)}  4`)
  expect(lines[11]).toBe(`10  ${'#'.repeat(20)}  8`)
  expect(lines[24]).toBe(`23  ${'#'.repeat(5).padEnd(20)}  2`)
  expect(lines[25]).toBe('Peak hour: 10:00 to 11:00, 8 of 15 prompts (53%).')
  expect(session.copied()).toEqual([])
})

test('night-owl: counts line up when one hour has two digits', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 3: 12, 4: 1 }) } })
  const lines = (await session.run('hours')).split('\n')
  expect(lines[4]).toBe(`03  ${'#'.repeat(20)}  12`)
  expect(lines[5]).toBe(`04  ${'##'.padEnd(20)}   1`)
})

test('night-owl: a peak after 23:00 ends at midnight', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 23: 3 }) } })
  expect((await session.run('hours')).split('\n').at(-1)).toBe('Peak hour: 23:00 to 00:00, 3 of 3 prompts (100%).')
})

test('night-owl: a tie names the earliest hour', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 7: 2, 21: 2 }) } })
  expect((await session.run('hours')).split('\n').at(-1)).toBe('Peak hour: 07:00 to 08:00, 2 of 4 prompts (50%).')
})

test('night-owl: one prompt reads in the singular', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 5: 1 }) } })
  const lines = (await session.run('hours')).split('\n')
  expect(lines[0]).toBe('Prompts by hour, local time (1 prompt)')
  expect(lines.at(-1)).toBe('Peak hour: 05:00 to 06:00, 1 of 1 prompt (100%).')
})

test('night-owl: with nothing recorded the answer says when it will fill', async ($, on) => {
  const session = probe($, on)
  expect(await session.run('hours')).toBe('No prompts recorded yet. Your hours show here after your next prompt.')
})

test('night-owl: a junk store value reads as no prompts, and the next turn writes a clean one', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 8, 30), store: { hours: ['a', -3, null] } })
  expect(await session.run('hours')).toMatch(/^No prompts recorded yet/)
  await session.turn()
  expect(hours(session)).toEqual(seeded({ 8: 1 }))
})

test('night-owl: no em-dashes', async ($, on) => {
  const session = probe($, on, { store: { hours: seeded({ 1: 1 }) } })
  expect(await session.run('hours')).not.toContain(String.fromCharCode(0x2014))
})
