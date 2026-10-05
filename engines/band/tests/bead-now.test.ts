import { expect, test } from 'claude-code/testing'

import { IN_PROGRESS, KEYS, REAL, bdCalls, bdTimeouts, fakeBd, json, segmentOf, afterBd } from './bd-fixtures'
import { SURFACES, probe } from './probe'

const ID = 'bead-now'
const text = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => (await segmentOf(session, ID, surface))?.text

const withList = (list: unknown) => fakeBd({ ...REAL, [KEYS.list]: json(list) })

test('bead-now: the bead updated last, its title cut to 40 characters, and how many more', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  for (const surface of SURFACES) expect(await text(session, surface)).toBe("▶ bm-ooq.64 [bug] intake/actions.ts is a 'use serve… +2")
  // One run, also in a pack where epic-bar asks the same.
  expect(bdCalls(session, KEYS.list)).toEqual([['bd', 'list', '--status', 'in_progress', '--limit', '0', '--json']])
})

test('bead-now: one bead in progress has no count, a short title is whole', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withList([IN_PROGRESS[0]]))
  await session.start()
  await session.settle()
  expect(await text(session)).toBe('▶ bm-lwgso.18 Portal gaps, part two')
})

test('bead-now: a tie in the update time goes to the id, and free text stays on one line', async ($, on) => {
  const session = probe($, on)
  const at = '2026-10-05T10:00:00Z'
  session.setCommand('bd', withList([{ id: 'bm-b', title: 'b', updated_at: at }, { id: 'bm-a', title: 'line one\nline\u001b[31m two', updated_at: at }]))
  await session.start()
  await session.settle()
  expect(await text(session)).toBe('▶ bm-a line one line[31m two +1')
})

// Several reads in a row: more time on a loaded machine.
test('bead-now: nothing in progress, no beads project, or bad output shows nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withList([]))
  await session.start()
  await session.settle()
  expect(await text(session)).toBeUndefined()
  for (const reply of [{ exitCode: 1 }, { stdout: '' }, { stdout: 'not json' }, { stdout: '{}' }, json([null, { title: 'no id' }])]) {
    session.setCommand('bd', fakeBd({ ...REAL, [KEYS.list]: reply }))
    await afterBd(session)
    expect(await text(session)).toBeUndefined()
  }
})

test('bead-now: without bd it shows nothing and logs once', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(await text(session)).toBeDefined()
  session.setCommand('bd', 'reject')
  await session.advance(120_000)
  await session.advance(120_000)
  expect(await text(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes(`${ID} `)).length).toBe(1)
})

test('bead-now: at most one read every two minutes with a 10 s timeout, and one after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  const first = bdCalls(session, KEYS.list).length
  expect(first).toBeGreaterThan(0)
  await session.advance(119_000)
  expect(bdCalls(session, KEYS.list).length).toBe(first)
  await session.advance(1000)
  expect(bdCalls(session, KEYS.list).length).toBeGreaterThan(first)
  const timed = bdCalls(session, KEYS.list).length
  await afterBd(session)
  expect(bdCalls(session, KEYS.list).length).toBeGreaterThan(timed)
  expect(new Set(bdTimeouts(session, KEYS.list))).toEqual(new Set([10_000]))
})
