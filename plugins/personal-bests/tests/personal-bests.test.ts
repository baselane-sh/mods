import { expect, test } from 'claude-code/testing'

import { HOUR, NOON, TODAY, day, probe } from './probe'

const MINUTE = 60_000
const YESTERDAY = '2026-10-03'

type Best = { value: number; date: string; owner: string }

const bests = (session: ReturnType<typeof probe>) => session.stored()['bests'] as Record<string, Best> | undefined
const news = (session: ReturnType<typeof probe>) => session.toasts().filter(t => t.startsWith('New personal best'))

// A record set in another session, on another day.
const old = (value: number): Best => ({ value, date: '2026-09-01', owner: 'earlier' })

// One /bests row: the longest label is 32 wide; `width` is the widest value.
const row = (label: string, value: string, date?: string, width = 0): string =>
  date === undefined ? `${label.padEnd(32)}  ${value}` : `${label.padEnd(32)}  ${value.padEnd(width)}  ${date}`

test('personal-bests: registers /bests', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('bests')
})

test('personal-bests: the first values are set quietly, as the marks to beat', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - 10 * MINUTE })
  await session.bash('ls')
  await session.edit('/repo/a.ts')
  await session.turn()
  const owner = String(NOON - 10 * MINUTE)
  expect(bests(session)).toEqual({
    longest: { value: 10 * MINUTE, date: TODAY, owner },
    calls: { value: 2, date: TODAY, owner },
    files: { value: 1, date: TODAY, owner: TODAY },
  })
  expect(news(session)).toEqual([])
})

test('personal-bests: a nothing value sets no mark', async ($, on) => {
  const session = probe($, on)
  await session.turn()
  expect(bests(session)).toBeUndefined()
})

test('personal-bests: a longer session beats the record once, then grows it quietly', async ($, on) => {
  const startedAt = NOON - 2 * HOUR
  const session = probe($, on, { startedAt, store: { bests: { longest: old(HOUR) } } })
  await session.turn()
  expect(news(session)).toEqual(['New personal best: longest session, 2 h 0 min (was 1 h 0 min)'])
  await session.advance(15 * MINUTE)
  await session.turn()
  expect(news(session)).toHaveLength(1)
  expect(bests(session)?.['longest']).toEqual({ value: 2 * HOUR + 15 * MINUTE, date: TODAY, owner: String(startedAt) })
})

test('personal-bests: a shorter session leaves the record alone', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - 30 * MINUTE, store: { bests: { longest: old(HOUR) } } })
  await session.turn()
  expect(news(session)).toEqual([])
  expect(bests(session)?.['longest']).toEqual(old(HOUR))
})

test('personal-bests: tool calls add up across the turns of a session', async ($, on) => {
  const session = probe($, on, { store: { bests: { calls: old(5) } } })
  for (let i = 0; i < 3; i += 1) await session.bash(`echo ${i}`)
  await session.turn()
  expect(news(session)).toEqual([])
  for (let i = 0; i < 3; i += 1) await session.read(`/repo/${i}`)
  await session.turn()
  expect(news(session)).toEqual(['New personal best: most tool calls in a session, 6 (was 5)'])
})

test('personal-bests: a resumed session never lowers its own record', async ($, on) => {
  // A resume keeps the session's first start, and a new process counts its calls from 0.
  const startedAt = NOON - 20 * HOUR
  const own: Best = { value: 800, date: YESTERDAY, owner: String(startedAt) }
  const session = probe($, on, { startedAt, store: { bests: { calls: own } } })
  for (let i = 0; i < 3; i += 1) await session.bash(`echo ${i}`)
  await session.turn()
  expect(bests(session)?.['calls']).toEqual(own)
  expect(news(session)).toEqual([])
})

test('personal-bests: a resumed session counts its length from the resume, not the time away', async ($, on) => {
  const startedAt = NOON - 20 * HOUR
  const session = probe($, on, { startedAt, store: { bests: { longest: old(3 * HOUR) } } })
  await session.start()
  await session.advance(10 * MINUTE)
  await session.turn()
  expect(news(session)).toEqual([])
  expect(bests(session)?.['longest']).toEqual(old(3 * HOUR))
  await session.advance(3 * HOUR)
  await session.turn()
  expect(news(session)).toEqual(['New personal best: longest session, 3 h 10 min (was 3 h 0 min)'])
})

test('personal-bests: after a /clear the tool calls count again from 0', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - HOUR })
  for (let i = 0; i < 3; i += 1) await session.bash(`echo ${i}`)
  await session.turn()
  expect(bests(session)?.['calls']?.value).toBe(3)
  await session.end('clear')
  // A /clear starts the session over at that moment.
  session.setStartedAt(NOON)
  await session.bash('ls')
  await session.turn()
  expect(news(session)).toEqual([])
  expect(bests(session)?.['calls']?.value).toBe(3)
})

test('personal-bests: files edited count the whole day, other sessions included', async ($, on) => {
  const session = probe($, on, {
    store: { days: { [TODAY]: day({ sessions: 1, turns: 1, files: 2 }) }, bests: { files: { value: 2, date: YESTERDAY, owner: YESTERDAY } } },
  })
  await session.edit('/repo/new.ts')
  await session.turn()
  expect(news(session)).toEqual(['New personal best: most files edited in a day, 3 (was 2)'])
  expect(bests(session)?.['files']).toEqual({ value: 3, date: TODAY, owner: TODAY })
})

test('personal-bests: tying a record does not beat it', async ($, on) => {
  const session = probe($, on, { store: { bests: { calls: old(2) } } })
  await session.bash('ls')
  await session.bash('pwd')
  await session.turn()
  expect(news(session)).toEqual([])
  expect(bests(session)?.['calls']).toEqual(old(2))
})

test('personal-bests: the cheapest session over 30 minutes is judged at its end, and told at the next start', async ($, on) => {
  const startedAt = NOON - 45 * MINUTE
  const session = probe($, on, { startedAt, usd: 0.8, store: { bests: { cheapest: old(1.5) } } })
  await session.end()
  expect(news(session)).toEqual([])
  expect(bests(session)?.['cheapest']).toEqual({ value: 0.8, date: TODAY, owner: String(startedAt) })
  await session.start()
  expect(news(session)).toEqual(['New personal best last session: cheapest session over 30 minutes, $0.80 (was $1.50)'])
  await session.advance(HOUR)
  await session.start()
  expect(news(session)).toHaveLength(1)
})

test('personal-bests: the cost of a session is not judged while it runs', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - HOUR, usd: 0.1, store: { bests: { cheapest: old(1.5) } } })
  await session.turn(0.2)
  expect(bests(session)?.['cheapest']).toEqual(old(1.5))
})

for (const [name, opts] of [
  ['under 30 minutes', { startedAt: NOON - 29 * MINUTE, usd: 0.1 }],
  ['dearer', { startedAt: NOON - HOUR, usd: 2 }],
  ['with no cost', { startedAt: NOON - HOUR }],
] as const) {
  test(`personal-bests: a session ${name} leaves the cheapest alone`, async ($, on) => {
    const session = probe($, on, { ...opts, store: { bests: { cheapest: old(1.5) } } })
    await session.end()
    await session.start()
    expect(bests(session)?.['cheapest']).toEqual(old(1.5))
    expect(news(session)).toEqual([])
  })
}

test('personal-bests: the first session over 30 minutes sets the cheapest mark quietly', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - 31 * MINUTE, usd: 3 })
  await session.end()
  await session.start()
  expect(bests(session)?.['cheapest']?.value).toBe(3)
  expect(news(session)).toEqual([])
})

test('personal-bests: /bests lists every record with its date, and the ones not set yet', async ($, on) => {
  const session = probe($, on, {
    store: {
      bests: {
        longest: { value: 2 * HOUR + 5 * MINUTE, date: '2026-10-02', owner: 'a' },
        calls: { value: 212, date: '2026-10-01', owner: 'b' },
        files: { value: 34, date: '2026-09-30', owner: '2026-09-30' },
      },
    },
  })
  expect((await session.run('bests')).split('\n')).toEqual([
    'PERSONAL BESTS',
    row('longest session', '2 h 5 min', '2026-10-02', 9),
    row('most tool calls in a session', '212', '2026-10-01', 9),
    row('most files edited in a day', '34', '2026-09-30', 9),
    row('cheapest session over 30 minutes', 'not yet'),
  ])
  expect(session.copied()).toEqual([])
})

test('personal-bests: a session under an hour reads in minutes', async ($, on) => {
  const session = probe($, on, { store: { bests: { longest: old(42 * MINUTE + 50_000) } } })
  expect((await session.run('bests')).split('\n')[1]).toMatch(/^longest session\s+42 min\s+2026-09-01$/)
})

test('personal-bests: junk in the store is dropped and replaced', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - 5 * MINUTE, store: { bests: { longest: 'forever', calls: { value: -1, date: 3 } } } })
  expect(await session.run('bests')).toContain(row('longest session', 'not yet'))
  await session.bash('ls')
  await session.turn()
  expect(bests(session)?.['longest']?.value).toBe(5 * MINUTE)
  expect(bests(session)?.['calls']?.value).toBe(1)
  expect(news(session)).toEqual([])
})

test('personal-bests: no em-dashes', async ($, on) => {
  const session = probe($, on, { startedAt: NOON - 2 * HOUR, store: { bests: { longest: old(HOUR) } } })
  await session.turn()
  expect(`${session.toasts().join('')}${await session.run('bests')}`).not.toContain(String.fromCharCode(0x2014))
})
