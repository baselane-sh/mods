import { expect, test } from 'claude-code/testing'

import { addDays } from '../hooks/date'
import { isTestCommand } from '../hooks/testcmd'
import { DENY_WORD, FAIL_WORD, HOUR, TODAY, at, back, day, probe } from './probe'

const YESTERDAY = addDays(TODAY, -1)

test('rollup: a session start counts one session, however often it is raised', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.start()
  expect(session.days()[TODAY]?.sessions).toBe(1)
})

test('rollup: a turn adds its turns, calls, tools, files, tests and blocks to today', async ($, on) => {
  const session = probe($, on, { usd: 1 })
  await session.start()
  await session.bash('ls')
  await session.bash('npm test')
  await session.bash(`npm test ${FAIL_WORD}`)
  await session.bash(`rm ${DENY_WORD}`)
  await session.edit('/repo/a.ts')
  await session.edit('/repo/a.ts')
  await session.write('/repo/b.ts')
  await session.read('/repo/c.ts')
  await session.turn(1.5)
  expect(session.days()[TODAY]).toEqual({
    sessions: 1,
    turns: 1,
    calls: 8,
    files: 2,
    passed: 1,
    failed: 1,
    blocked: 1,
    usd: 0.5,
    tools: { Bash: 4, Edit: 2, Write: 1, Read: 1 },
  })
  expect(session.stored()['life']).toEqual({ calls: 8, blocked: 1, passed: 1 })
})

test('rollup: a file touched in two turns of one session counts once', async ($, on) => {
  const session = probe($, on)
  await session.edit('/repo/a.ts')
  await session.turn()
  await session.edit('/repo/a.ts')
  await session.edit('/repo/b.ts')
  await session.turn()
  expect(session.days()[TODAY]?.files).toBe(2)
  expect(session.days()[TODAY]?.turns).toBe(2)
})

test('rollup: a denied write touched no file', async ($, on) => {
  const session = probe($, on)
  await session.write('/repo/a.ts')
  await session.bash(`${DENY_WORD}`)
  await session.turn()
  expect(session.days()[TODAY]?.files).toBe(1)
  expect(session.days()[TODAY]?.blocked).toBe(1)
})

test('rollup: a turn that completes twice is added once', async ($, on) => {
  const session = probe($, on, { usd: 1 })
  await session.bash('ls')
  await session.turn(2)
  await session.complete('t1')
  await session.complete('t1')
  expect(session.days()[TODAY]?.turns).toBe(1)
  expect(session.days()[TODAY]?.calls).toBe(1)
  expect(session.days()[TODAY]?.usd).toBe(1)
})

test('rollup: a subagent turn is not a turn', async ($, on) => {
  const session = probe($, on)
  await session.bash('ls')
  await session.complete('sub-1', { agentId: 'agent-7' })
  expect(session.days()[TODAY]).toBeUndefined()
  await session.turn()
  expect(session.days()[TODAY]?.turns).toBe(1)
})

test('rollup: the calls of a turn that never ended are kept when the session ends', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.bash('ls')
  await session.bash('ls')
  await session.end()
  expect(session.days()[TODAY]?.calls).toBe(2)
  expect(session.days()[TODAY]?.turns).toBe(0)
})

test('rollup: cost is the turn delta, and absent when the host never said', async ($, on) => {
  const session = probe($, on)
  await session.turn()
  expect(session.days()[TODAY]?.usd).toBeUndefined()
  session.setUsd(10)
  await session.turn(10.25)
  await session.turn(10.75)
  expect(session.days()[TODAY]?.usd).toBe(0.75)
})

test('rollup: a cost that fell (a cleared session) adds nothing', async ($, on) => {
  const session = probe($, on, { usd: 5 })
  await session.turn(6)
  await session.turn(0.5)
  expect(session.days()[TODAY]?.usd).toBe(1)
})

test('rollup: each local day has its own entry, and midnight starts a new one', async ($, on) => {
  const session = probe($, on, { now: at(2026, 10, 4, 23, 30) })
  await session.bash('ls')
  await session.turn()
  await session.advance(HOUR)
  await session.bash('ls')
  await session.bash('ls')
  await session.turn()
  expect(session.days()['2026-10-04']?.calls).toBe(1)
  expect(session.days()['2026-10-05']?.calls).toBe(2)
})

test('rollup: days older than 400 are pruned, 400 are kept', async ($, on) => {
  const session = probe($, on, {
    store: { days: { [addDays(TODAY, -401)]: day({ turns: 1 }), [addDays(TODAY, -400)]: day({ turns: 1 }), [YESTERDAY]: day({ turns: 1 }) } },
  })
  await session.turn()
  const kept = Object.keys(session.days())
  expect(kept).not.toContain(addDays(TODAY, -401))
  expect(kept).toContain(addDays(TODAY, -400))
  expect(kept).toContain(YESTERDAY)
})

test('rollup: a day keeps its tool counts small', async ($, on) => {
  const session = probe($, on)
  for (let i = 0; i < 40; i += 1) await session.read(`/r/${i}`)
  for (let i = 0; i < 40; i += 1) await $.tool.call({ tool: `mcp__x__t${i}` })
  await session.turn()
  const tools = session.days()[TODAY]?.tools ?? {}
  expect(Object.keys(tools).length).toBeLessThanOrEqual(26)
  expect(Object.values(tools).reduce((a, b) => a + b, 0)).toBe(80)
})

test('rollup: a store that holds junk is replaced, not trusted', async ($, on) => {
  const session = probe($, on, { store: { days: 'lots', life: [1, 2] } })
  await session.bash('ls')
  await session.turn()
  expect(session.days()[TODAY]?.calls).toBe(1)
  expect(session.stored()['life']).toEqual({ calls: 1, blocked: 0, passed: 0 })
})

test('rollup: a day entry with missing fields is read as zeros', async ($, on) => {
  const session = probe($, on, { store: { days: { [YESTERDAY]: { turns: 3 } } } })
  await session.turn()
  expect(session.days()[YESTERDAY]).toEqual(day({ turns: 3 }))
})

test('rollup: a store write that fails is logged and the hook still answers', async ($, on) => {
  const session = probe($, on, { setFails: true })
  await session.bash('ls')
  await session.turn()
  expect(session.logs().join('\n')).toMatch(/disk full/)
})

test('rollup: older entries stay exactly as they were', async ($, on) => {
  const old = day({ sessions: 2, turns: 9, calls: 50, usd: 3, tools: { Bash: 50 } })
  const session = probe($, on, { store: { days: { [back(3, 1)[0] ?? '']: old } } })
  await session.turn()
  expect(session.days()[back(3, 1)[0] ?? '']).toEqual(old)
})

test('test commands: runners count, quoted names and plain commands do not', () => {
  const yes = ['npm test', 'npm run test -- --watch=false', 'pnpm test', 'yarn test', 'bun test', 'npx vitest run', 'cd app && npm test', 'CI=1 pytest -q', 'uv run pytest tests', 'go test ./...', 'cargo test', 'jest --ci']
  const no = ['ls', 'git commit -m "fix jest config"', 'echo npm test', 'npm install', 'cat pytest.ini', 'grep -r vitest src']
  expect(yes.filter(c => !isTestCommand(c))).toEqual([])
  expect(no.filter(c => isTestCommand(c))).toEqual([])
})

test('rollup: a Bash test run that is denied is neither passed nor failed', async ($, on) => {
  const session = probe($, on)
  await session.bash(`npm test ${DENY_WORD}`)
  await session.turn()
  expect(session.days()[TODAY]?.passed).toBe(0)
  expect(session.days()[TODAY]?.failed).toBe(0)
  expect(session.days()[TODAY]?.blocked).toBe(1)
})
