import { expect, test } from 'claude-code/testing'

import { DENY_WORD, FAIL_WORD, TODAY, at, back, probe } from './probe'

const beadToasts = (session: ReturnType<typeof probe>) => session.toasts().filter(t => t.includes('bead streak'))
const counts = (dates: readonly string[]) => Object.fromEntries(dates.map(date => [date, 1]))

test('bead-streak: registers /bead-streak', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('bead-streak')
})

test('bead-streak: nothing closed yet says how to start', async ($, on) => {
  const session = probe($, on)
  expect(await session.run('bead-streak')).toBe(
    ['Bead streak: 0 days (best 0 days)', 'last 14 days  ..............', 'Close a bead with bd close to start a streak.'].join('\n'),
  )
})

test('bead-streak: a close that exits 0 counts the day, any number of closes is one day', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1 bm-2')
  await session.bash('cd /repo && bd -C /repo close bm-3')
  await session.bash('bd done bm-4')
  expect(session.stored()['bead-days']).toEqual({ [TODAY]: 3 })
  expect(await session.run('bead-streak')).toMatch(/^Bead streak: 1 day \(best 1 day\)\nlast 14 days  \.{13}#$/)
})

test('bead-streak: failed, blocked and look-alike commands do not count', async ($, on) => {
  const session = probe($, on)
  await session.bash(`bd close bm-1 ${FAIL_WORD}`)
  await session.bash(`bd close bm-1 ${DENY_WORD}`)
  await session.bash('echo "bd close bm-1"')
  await session.bash('bd ready')
  await session.bash('bd close --help')
  await session.write('/repo/bd close')
  expect(session.stored()['bead-days']).toBeUndefined()
})

test('bead-streak: a run of days shows as the streak, today open keeps yesterday alive', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': counts(back(1, 3)) } })
  expect(await session.run('bead-streak')).toBe(
    ['Bead streak: 3 days (best 3 days)', 'last 14 days  ..........###.', 'Close a bead today to keep it going.'].join('\n'),
  )
})

test('bead-streak: a missed day ends the streak', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': counts(back(2, 5)), 'bead-best': 5 } })
  expect(await session.run('bead-streak')).toMatch(/^Bead streak: 0 days \(best 5 days\)/)
})

test('bead-streak: the first day sets the mark and toasts nothing', async ($, on) => {
  const session = probe($, on)
  await session.bash('bd close bm-1')
  expect(beadToasts(session)).toEqual([])
  expect(session.stored()['bead-best']).toBe(1)
})

test('bead-streak: passing the best toasts once, on the first close of the day', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': counts(back(1, 3)), 'bead-best': 3 } })
  await session.bash('bd close bm-1')
  await session.bash('bd close bm-2')
  expect(beadToasts(session)).toEqual(['New best bead streak: 4 days'])
  expect(session.stored()['bead-best']).toBe(4)
})

test('bead-streak: tying the best or building a shorter streak toasts nothing', async ($, on) => {
  const tie = probe($, on, { store: { 'bead-days': counts(back(1, 3)), 'bead-best': 4 } })
  await tie.bash('bd close bm-1')
  expect(beadToasts(tie)).toEqual([])
})

test('bead-streak: an old longer run in the days counts as the best even with no stored best', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': counts([...back(1, 2), ...back(10, 6)]) } })
  await session.bash('bd close bm-1')
  expect(beadToasts(session)).toEqual([])
  expect(await session.run('bead-streak')).toMatch(/best 6 days/)
})

test('bead-streak: the day follows the local clock', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 5, 0, 30), store: { 'bead-days': counts(back(0, 2)) } })
  await session.bash('bd close bm-1')
  expect(Object.keys(session.stored()['bead-days'] as object).sort()).toEqual(['2026-10-03', '2026-10-04', '2026-10-05'])
})

test('bead-streak: junk in the store is ignored', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': { x: 1, '2026-10-03': 'many', [TODAY]: -2, '2026-10-02': 2 }, 'bead-best': 'big' } })
  expect(await session.run('bead-streak')).toMatch(/^Bead streak: 0 days \(best 1 day\)/)
})

test('bead-streak: a store value of the wrong shape is replaced', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': ['2026-10-03'] } })
  await session.bash('bd close bm-1')
  expect(session.stored()['bead-days']).toEqual({ [TODAY]: 1 })
})

test('bead-streak: a store that fails to write is logged and the call goes on', async ($, on) => {
  const session = probe($, on, { setFails: true })
  const ran = await session.bash('bd close bm-1')
  expect(ran).toEqual({ result: {} })
  expect(session.logs().some(line => line.startsWith('stats: bead-streak skipped'))).toBe(true)
})

test('bead-streak: days older than 400 are pruned', async ($, on) => {
  const session = probe($, on, { store: { 'bead-days': { '2024-01-01': 3, [back(1, 1)[0] as string]: 1 } } })
  await session.bash('bd close bm-1')
  expect(Object.keys(session.stored()['bead-days'] as object)).not.toContain('2024-01-01')
})
