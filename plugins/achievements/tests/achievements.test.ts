import { expect, test } from 'claude-code/testing'

import { DENY_WORD, FAIL_WORD, HOUR, TODAY, activeDays, at, back, probe } from './probe'

const badges = (session: ReturnType<typeof probe>) => session.stored()['badges'] as Record<string, string> | undefined
const unlocked = (session: ReturnType<typeof probe>) => session.toasts().filter(t => t.startsWith('Achievement unlocked'))

test('achievements: registers /achievements and lists all eight locked', async ($, on) => {
  const session = probe($, on)
  expect(await session.run('achievements')).toMatch(/0\/8/)
  await session.start()
  expect(session.registered()).toContain('achievements')
})

test('achievements: the listing shows locked and unlocked with the date', async ($, on) => {
  const session = probe($, on)
  await session.start()
  const text = await session.run('achievements')
  expect(text).toMatch(/1\/8/)
  expect(text).toMatch(/\[x\] First session\s+2026-10-04/)
  expect(text).toMatch(/\[ \] First green test run/)
  for (const name of ['100 tool calls', '1,000 tool calls', '7-day streak', '10 blocked risky calls', 'Marathon', 'Night owl']) {
    expect(text).toContain(name)
  }
  expect(session.copied()).toEqual([])
})

test('achievements: first session unlocks at the first start, once, with a toast', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.start()
  await session.turn()
  expect(unlocked(session)).toEqual(['Achievement unlocked: First session'])
  expect(badges(session)).toEqual({ 'first-session': TODAY })
})

test('achievements: a failing test run does not unlock the green one, a passing run does, once', async ($, on) => {
  const session = probe($, on)
  await session.bash(`npm test ${FAIL_WORD}`)
  await session.turn()
  expect(badges(session)?.['first-green-test']).toBeUndefined()
  await session.bash('npm test')
  await session.turn()
  await session.bash('npm test')
  await session.turn()
  expect(unlocked(session).filter(t => t.includes('green'))).toEqual(['Achievement unlocked: First green test run'])
  expect(badges(session)?.['first-green-test']).toBe(TODAY)
})

test('achievements: 100 tool calls unlocks at the hundredth, not the ninety-ninth', async ($, on) => {
  const session = probe($, on)
  for (let i = 0; i < 99; i += 1) await session.read(`/r/${i}`)
  await session.turn()
  expect(badges(session)?.['calls-100']).toBeUndefined()
  await session.read('/r/last')
  await session.turn()
  expect(unlocked(session)).toContain('Achievement unlocked: 100 tool calls')
  expect(badges(session)?.['calls-1000']).toBeUndefined()
})

test('achievements: lifetime calls cross 1,000 across sessions and days', async ($, on) => {
  const session = probe($, on, { store: { life: { calls: 999, blocked: 0, passed: 0 }, badges: { 'first-session': '2026-01-01' } } })
  await session.read('/r/1')
  await session.turn()
  expect(unlocked(session)).toEqual(['Achievement unlocked: 100 tool calls', 'Achievement unlocked: 1,000 tool calls'])
})

test('achievements: a 7-day streak unlocks on the seventh day with a turn', async ($, on) => {
  const six = probe($, on, { store: { days: activeDays(back(1, 5)) } })
  await six.turn()
  expect(badges(six)?.['streak-7']).toBeUndefined()
})

test('achievements: six days behind today and a turn make seven', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays(back(1, 6)) } })
  await session.turn()
  expect(unlocked(session)).toContain('Achievement unlocked: 7-day streak')
  expect(badges(session)?.['streak-7']).toBe(TODAY)
})

test('achievements: a gap in the week means no 7-day streak', async ($, on) => {
  const session = probe($, on, { store: { days: activeDays([...back(1, 2), ...back(4, 4)]) } })
  await session.turn()
  expect(badges(session)?.['streak-7']).toBeUndefined()
})

test('achievements: ten blocked calls unlock, nine do not', async ($, on) => {
  const session = probe($, on)
  for (let i = 0; i < 9; i += 1) await session.bash(`rm ${DENY_WORD} ${i}`)
  await session.turn()
  expect(badges(session)?.['blocked-10']).toBeUndefined()
  await session.bash(`rm ${DENY_WORD} last`)
  await session.turn()
  expect(unlocked(session)).toContain('Achievement unlocked: 10 blocked risky calls')
})

test('achievements: blocked calls add up across turns', async ($, on) => {
  const session = probe($, on)
  for (let i = 0; i < 10; i += 1) {
    await session.bash(`rm ${DENY_WORD} ${i}`)
    await session.turn()
  }
  expect(badges(session)?.['blocked-10']).toBe(TODAY)
})

test('achievements: a session over two hours unlocks at the next turn, an hour and 59 minutes does not', async ($, on) => {
  const session = probe($, on)
  await session.advance(2 * HOUR - 60_000)
  await session.turn()
  expect(badges(session)?.['marathon']).toBeUndefined()
  await session.advance(2 * 60_000)
  await session.turn()
  expect(unlocked(session)).toContain('Achievement unlocked: Marathon')
})

for (const [hour, minute, expected] of [
  [0, 0, true],
  [3, 59, true],
  [4, 0, false],
  [23, 59, false],
  [12, 0, false],
] as const) {
  test(`achievements: a turn at ${hour}:${String(minute).padStart(2, '0')} ${expected ? 'makes' : 'does not make'} a night owl`, async ($, on) => {
    const session = probe($, on, { now: at(2026, 10, 4, hour, minute) })
    await session.turn()
    expect(badges(session)?.['night-owl'] !== undefined).toBe(expected)
  })
}

test('achievements: every badge unlocks once however many turns follow, and keeps its first date', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 1, 0) })
  await session.start()
  await session.bash('npm test')
  await session.turn()
  const first = unlocked(session).length
  expect(first).toBe(3)
  await session.advance(30 * HOUR)
  await session.start()
  await session.bash('npm test')
  await session.turn()
  await session.turn()
  expect(unlocked(session).length).toBe(first + 1)
  expect(badges(session)?.['first-session']).toBe(TODAY)
  expect(badges(session)?.['night-owl']).toBe(TODAY)
})

test('achievements: a badge already in the store is not toasted again', async ($, on) => {
  const session = probe($, on, { store: { badges: { 'first-session': '2026-01-01' } } })
  await session.start()
  expect(unlocked(session)).toEqual([])
  expect(badges(session)?.['first-session']).toBe('2026-01-01')
})

test('achievements: a badges value that is junk is replaced', async ($, on) => {
  const session = probe($, on, { store: { badges: 'all of them' } })
  await session.start()
  expect(badges(session)).toEqual({ 'first-session': TODAY })
})

test('achievements: no em-dashes', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(`${session.toasts().join('')}${await session.run('achievements')}`).not.toContain(String.fromCharCode(0x2014))
})
