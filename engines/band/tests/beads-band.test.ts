import { expect, test } from 'claude-code/testing'

import { KEYS, REAL, STATUS, bdCalls, bdTimeouts, fakeBd, json, segmentOf } from './bd-fixtures'
import { SURFACES, probe } from './probe'

const ID = 'beads-band'
const text = async (session: ReturnType<typeof probe>, surface: (typeof SURFACES)[number] = 'terminal') => (await segmentOf(session, ID, surface))?.text

const withSummary = (summary: Record<string, unknown>) => fakeBd({ ...REAL, [KEYS.status]: json({ ...STATUS, summary: { ...STATUS.summary, ...summary } }) })

test('beads-band: ready, active and blocked from bd status, from the session start', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  for (const surface of SURFACES) expect(await text(session, surface)).toBe('bd 96 ready · 45 active · 29 blocked')
  expect(bdCalls(session, KEYS.status)[0]).toEqual(['bd', 'status', '--json'])
  expect((await segmentOf(session, ID))?.color).toBeUndefined()
})

test('beads-band: a part that is 0 drops, except ready', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withSummary({ in_progress_issues: 0 }))
  await session.start()
  await session.settle()
  expect(await text(session)).toBe('bd 96 ready · 29 blocked')
  session.setCommand('bd', withSummary({ ready_issues: 0, in_progress_issues: 0, blocked_issues: 0 }))
  await session.bash('bd close bm-1')
  expect(await text(session)).toBe('bd 0 ready')
})

test('beads-band: no beads project, empty output or bad JSON shows nothing', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', { exitCode: 1, stdout: '' })
  await session.start()
  await session.settle()
  expect(await text(session)).toBeUndefined()
  for (const reply of [{ stdout: '' }, { stdout: 'not json' }, { stdout: '{"summary":null}' }, { stdout: '[]' }, json({ summary: { ready_issues: -1, in_progress_issues: 0, blocked_issues: 0 } })]) {
    session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: reply }))
    await session.bash('ls')
    expect(await text(session)).toBeUndefined()
  }
  // A good answer with exit 1 is still a failed read.
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: { ...json(STATUS), exitCode: 1 } }))
  await session.bash('ls')
  expect(await text(session)).toBeUndefined()
})

test('beads-band: without bd it shows nothing, logs once and does not retry in a loop', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  expect(await text(session)).toBe('bd 96 ready · 45 active · 29 blocked')
  session.setCommand('bd', 'reject')
  const before = bdCalls(session, KEYS.status).length
  await session.advance(120_000)
  await session.advance(120_000)
  expect(await text(session)).toBeUndefined()
  expect(session.logs().filter(line => line.includes(`${ID} `)).length).toBe(1)
  // One run per two minutes, two at most in a pack where beads-done-bar reads it too.
  const runs = bdCalls(session, KEYS.status).length - before
  expect(runs).toBeGreaterThanOrEqual(2)
  expect(runs).toBeLessThanOrEqual(4)
})

test('beads-band: at most one read every two minutes, each with a 10 s timeout, and one after a Bash call', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.turn({})
  const first = bdCalls(session, KEYS.status).length
  await session.turn({})
  await session.advance(119_000)
  expect(bdCalls(session, KEYS.status).length).toBe(first)
  await session.advance(1000)
  expect(bdCalls(session, KEYS.status).length).toBeGreaterThan(first)
  const timed = bdCalls(session, KEYS.status).length
  await session.bash('bd update bm-1 --claim')
  expect(bdCalls(session, KEYS.status).length).toBeGreaterThan(timed)
  expect(new Set(bdTimeouts(session, KEYS.status))).toEqual(new Set([10_000]))
})

test('beads-band: a slow bd never holds back a tool result', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: { ...json(STATUS), delayMs: 8000 } }))
  expect(await session.bash('ls')).toEqual({ result: {} })
  expect(await text(session)).toBeUndefined()
  await session.advance(8000)
  expect(await text(session)).toBe('bd 96 ready · 45 active · 29 blocked')
})
