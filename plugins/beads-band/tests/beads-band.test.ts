import { expect, test } from 'claude-code/testing'

import { KEYS, REAL, STATUS, bdCalls, bdTimeouts, fakeBd, json, segmentOf, afterBd } from './bd-fixtures'
import { bdJson, ranBd } from '../hooks/beads'
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
  // One run, also in a pack where beads-done-bar asks the same.
  expect(bdCalls(session, KEYS.status)).toEqual([['bd', 'status', '--json']])
  expect((await segmentOf(session, ID))?.color).toBeUndefined()
})

test('beads-band: a part that is 0 drops, except ready', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', withSummary({ in_progress_issues: 0 }))
  await session.start()
  await session.settle()
  expect(await text(session)).toBe('bd 96 ready · 29 blocked')
  session.setCommand('bd', withSummary({ ready_issues: 0, in_progress_issues: 0, blocked_issues: 0 }))
  await afterBd(session)
  expect(await text(session)).toBe('bd 0 ready')
})

// Several reads in a row: more time on a loaded machine.
test('beads-band: no beads project, empty output or bad JSON shows nothing', { timeoutMs: 30_000 }, async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', { exitCode: 1, stdout: '' })
  await session.start()
  await session.settle()
  expect(await text(session)).toBeUndefined()
  for (const reply of [{ stdout: '' }, { stdout: 'not json' }, { stdout: '{"summary":null}' }, { stdout: '[]' }, json({ summary: { ready_issues: -1, in_progress_issues: 0, blocked_issues: 0 } })]) {
    session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: reply }))
    await afterBd(session)
    expect(await text(session)).toBeUndefined()
  }
  // A good answer with exit 1 is still a failed read.
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: { ...json(STATUS), exitCode: 1 } }))
  await afterBd(session)
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
  // One run per two minutes; in a pack beads-done-bar shares it.
  const runs = bdCalls(session, KEYS.status).length - before
  expect(runs).toBe(2)
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
  await afterBd(session)
  expect(bdCalls(session, KEYS.status).length).toBeGreaterThan(timed)
  expect(new Set(bdTimeouts(session, KEYS.status))).toEqual(new Set([10_000]))
})

test('beads-band: a slow bd never holds back a tool result', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd({ ...REAL, [KEYS.status]: { ...json(STATUS), delayMs: 8000 } }))
  expect(await session.bash('bd close bm-1')).toEqual({ result: {} })
  expect(await text(session)).toBeUndefined()
  await session.advance(8000)
  expect(await text(session)).toBe('bd 96 ready · 45 active · 29 blocked')
})

test('beads-band: only a Bash call that ran bd reads again', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', fakeBd(REAL))
  await session.start()
  await session.settle()
  const first = bdCalls(session, KEYS.status).length
  for (const command of ['ls', 'echo "bd close x"', 'abd list', "git commit -m 'bd close x'"]) {
    await session.advance(3000)
    await session.bash(command)
  }
  await session.advance(3000)
  await session.tool('Edit')
  expect(bdCalls(session, KEYS.status).length).toBe(first)
  await session.advance(3000)
  await session.bash('bd close x')
  expect(bdCalls(session, KEYS.status).length).toBe(first + 1)
})

test('beads-band: bd as a command word, not inside other words or quotes', () => {
  const ran = (command: string) => ranBd({ tool: 'Bash', command })
  for (const command of ['bd close x', 'bd', 'cd /r && bd ready', 'git pull; bd sync', 'x || bd list', 'a | bd q', 'echo $(bd list)', '(bd list)', 'BEADS_DIR=/x bd list', '/opt/homebrew/bin/bd list', './bd status', 'ls\nbd list']) {
    expect({ command, ran: ran(command) }).toEqual({ command, ran: true })
  }
  for (const command of ['ls', 'echo "bd close"', "echo 'bd close'", 'abd list', 'bd-tool x', 'echo bd', 'cat notes.bd', 'git commit -m "fix; bd close"']) {
    expect({ command, ran: ran(command) }).toEqual({ command, ran: false })
  }
  expect(ranBd({ tool: 'Edit' })).toBe(false)
})

test('beads-band: the same bd read in one generation within 3 s is one run', async () => {
  let runs: readonly (readonly string[])[] = []
  const run = async (argv: readonly string[]) => {
    runs = [...runs, argv]
    return { exitCode: 0, stdout: '{"count":1}', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
  }
  // Far from the probe's clock and generations, so no run of a mod under test is shared.
  const [a, b] = await Promise.all([bdJson(run, ['count'], { now: 1000, generation: -1 }), bdJson(run, ['count'], { now: 3999, generation: -1 })])
  expect([a, b]).toEqual([{ count: 1 }, { count: 1 }])
  expect(runs.length).toBe(1)
  // A read after an edit never reuses one from before it.
  await bdJson(run, ['count'], { now: 1500, generation: -2 })
  expect(runs.length).toBe(2)
  await bdJson(run, ['count'], { now: 4500, generation: -2 })
  await bdJson(run, ['count', '--by-priority'], { now: 4500, generation: -2 })
  expect(runs.length).toBe(4)
})

const readyIs = (ready: number, delayMs?: number) =>
  fakeBd({ ...REAL, [KEYS.status]: { ...json({ ...STATUS, summary: { ...STATUS.summary, ready_issues: ready } }), ...(delayMs === undefined ? {} : { delayMs }) } })

test('beads-band: bd run while a timed read is under way shows the new figure', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', readyIs(10, 1000))
  await session.turn({})
  await session.advance(300)
  session.setCommand('bd', readyIs(9))
  await session.bash('bd close x')
  await session.advance(1000)
  expect(await text(session)).toBe('bd 9 ready · 45 active · 29 blocked')
  // The timed read, then one more after the close.
  expect(bdCalls(session, KEYS.status).length).toBe(2)
})

test('beads-band: two bd runs 2 s apart each show their figure', async ($, on) => {
  const session = probe($, on)
  session.setCommand('bd', readyIs(10))
  await session.turn({})
  await session.advance(5000)
  session.setCommand('bd', readyIs(9))
  await session.bash('bd close a')
  expect(await text(session)).toBe('bd 9 ready · 45 active · 29 blocked')
  await session.advance(2000)
  session.setCommand('bd', readyIs(8))
  await session.bash('bd close b')
  expect(await text(session)).toBe('bd 8 ready · 45 active · 29 blocked')
})
