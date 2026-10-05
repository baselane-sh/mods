import { expect, test } from 'claude-code/testing'

import { BY_PRIORITY, BY_PRIORITY_CLOSED, KEYS, REAL, bdCalls, bdTimeouts, fakeBd, json, segmentOf, afterBd } from './bd-fixtures'
import type { Reply } from './bd-fixtures'
import { SURFACES, probe } from './probe'

const ID = 'priority-bar'
const found = (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => segmentOf(session, ID, surface)

const groups = (counts: Readonly<Record<string, number>>) => json({ groups: Object.entries(counts).map(([group, count]) => ({ count, group })), schema_version: 1 })

test('priority-bar: beads not closed, by priority', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  // All less closed: 10-10, 173-141, 1100-1027, 248-176.
  for (const surface of SURFACES) expect((await found(session, surface))?.text).toBe('P0 0 · P1 32 · P2 73 · P3 72')
  expect((await found(session))?.color).toBeUndefined()
  expect(bdCalls(session, KEYS.priority)[0]).toEqual(['bd', 'count', '--by-priority', '--json'])
  expect(bdCalls(session, KEYS.closed)[0]).toEqual(['bd', 'count', '--by-priority', '--status', 'closed', '--json'])
  expect(BY_PRIORITY.total - BY_PRIORITY_CLOSED.total).toBe(32 + 73 + 72)
})

test('priority-bar: red while a P0 is open; P4 only when it has beads', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.priority]: groups({ P0: 2, P1: 14, P2: 60, P3: 50, P4: 3 }), [KEYS.closed]: groups({}) }))
  await session.start()
  await session.settle()
  const shown = await found(session)
  expect(shown?.text).toBe('P0 2 · P1 14 · P2 60 · P3 50 · P4 3')
  expect(shown?.color).toBe('red')
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.priority]: groups({ P2: 4, P4: 1 }), [KEYS.closed]: groups({ P4: 1 }) }))
  await afterBd(session)
  expect((await found(session))?.text).toBe('P0 0 · P1 0 · P2 4 · P3 0')
})

// Several reads in a row: more time on a loaded machine.
test('priority-bar: all closed, no beads project or bad output shows nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.closed]: json(BY_PRIORITY) }))
  await session.start()
  await session.settle()
  expect(await found(session)).toBeUndefined()
  const tables: readonly Readonly<Record<string, Reply>>[] = [
    { [KEYS.priority]: { exitCode: 1 } },
    { [KEYS.closed]: { exitCode: 1 } },
    { [KEYS.priority]: { stdout: '' } },
    { [KEYS.priority]: { stdout: 'not json' } },
    { [KEYS.priority]: json({ groups: [] }) },
    { [KEYS.priority]: json({ groups: [{ group: 'high', count: 3 }] }) },
    { [KEYS.closed]: json([]) },
  ]
  for (const table of tables) {
    session.setCommand('bd', fakeBd({ ...REAL, ...table }))
    await afterBd(session)
    expect(await found(session)).toBeUndefined()
  }
})

test('priority-bar: without bd it shows nothing and logs once', async ($, on) => {
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

test('priority-bar: at most one read every two minutes with a 10 s timeout, and one after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(bdCalls(session, KEYS.priority).length).toBe(1)
  await session.advance(119_000)
  expect(bdCalls(session, KEYS.priority).length).toBe(1)
  await session.advance(1000)
  expect(bdCalls(session, KEYS.priority).length).toBe(2)
  await afterBd(session)
  expect(bdCalls(session, KEYS.priority).length).toBe(3)
  expect(bdTimeouts(session, KEYS.priority)).toEqual([10_000, 10_000, 10_000])
  expect(bdTimeouts(session, KEYS.closed)).toEqual([10_000, 10_000, 10_000])
})
