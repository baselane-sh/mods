import { expect, test } from 'claude-code/testing'

import { IN_PROGRESS, KEYS, REAL, bdCalls, bdTimeouts, fakeBd, json, segmentOf, afterBd } from './bd-fixtures'
import { SURFACES, probe } from './probe'

const ID = 'epic-bar'
const found = (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => segmentOf(session, ID, surface)

const epic = (id: string, closed: number, total: number, status = 'open') => ({
  epic: { id, title: 'A very long epic title that is never drawn because only the id fits the band', status },
  total_children: total,
  closed_children: closed,
  eligible_for_close: closed === total,
})

test('epic-bar: the epic of the bead in progress, as an 8 cell bar', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  // bm-ooq.64 was updated last; its parent bm-ooq has 60 of 80 closed.
  for (const surface of SURFACES) expect((await found(session, surface))?.text).toBe('bm-ooq ██████░░ 60/80')
  expect(bdCalls(session, KEYS.epics)[0]).toEqual(['bd', 'epic', 'status', '--json'])
  // One list run, also in a pack where bead-now asks the same.
  expect(bdCalls(session, KEYS.list).length).toBe(1)
  expect((await found(session))?.text).not.toContain('long')
})

test('epic-bar: with no bead in progress, the open epic nearest to done that is not done', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.list]: json([]) }))
  await session.start()
  await session.settle()
  // bm-zwf is complete and bm-nvpt (14/15) is nearer than bm-1fp (7/8).
  expect((await found(session))?.text).toBe('bm-nvpt ███████░ 14/15')
})

test('epic-bar: a parent that is not an epic falls back; a tie goes to the id', async ($, on) => {
  const session = probe($, on)
  const list = [{ ...IN_PROGRESS[1], parent: 'bm-task' }]
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.list]: json(list), [KEYS.epics]: json([epic('bm-b', 1, 2), epic('bm-a', 2, 4), epic('bm-c', 0, 0)]) }))
  await session.start()
  await session.settle()
  expect((await found(session))?.text).toBe('bm-a ████░░░░ 2/4')
})

test('epic-bar: a done epic of the bead in progress is full and green', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.epics]: json([epic('bm-ooq', 8, 8), epic('bm-x', 1, 2)]) }))
  await session.start()
  await session.settle()
  const shown = await found(session)
  expect(shown?.text).toBe('bm-ooq ████████ 8/8')
  expect(shown?.color).toBe('green')
})

// Several reads in a row: more time on a loaded machine.
test('epic-bar: no epics, only done epics, no beads project or bad output shows nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.epics]: json([]) }))
  await session.start()
  await session.settle()
  expect(await found(session)).toBeUndefined()
  // Nothing in progress and every epic done.
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.list]: json([]), [KEYS.epics]: json([epic('bm-d', 3, 3)]) }))
  await afterBd(session)
  expect(await found(session)).toBeUndefined()
  for (const reply of [{ exitCode: 1 }, { stdout: '' }, { stdout: 'not json' }, { stdout: '{}' }, json([{ epic: null }])]) {
    session.setCommand('bd', fakeBd({ ...REAL, [KEYS.epics]: reply }))
    await afterBd(session)
    expect(await found(session)).toBeUndefined()
  }
})

test('epic-bar: without bd it shows nothing and logs once', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(await found(session)).toBeDefined()
  session.setCommand('bd', 'reject')
  await session.advance(120_000)
  await session.advance(120_000)
  expect(await found(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes(`${ID} `)).length).toBe(1)
})

test('epic-bar: both reads in one run, at most every two minutes, each with a 10 s timeout', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  const first = bdCalls(session, KEYS.epics).length
  expect(first).toBe(1)
  await session.advance(119_000)
  expect(bdCalls(session, KEYS.epics).length).toBe(first)
  await session.advance(1000)
  expect(bdCalls(session, KEYS.epics).length).toBe(2)
  await afterBd(session)
  expect(bdCalls(session, KEYS.epics).length).toBe(3)
  expect(bdTimeouts(session, KEYS.epics)).toEqual([10_000, 10_000, 10_000])
})
