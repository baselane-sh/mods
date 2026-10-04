import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const SECOND = 1000
const said = (started: readonly (readonly string[])[]) => started.filter(argv => argv[0] === 'say')

test('say-done: on macOS says the line after a turn over 30 seconds', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.turnEnd(31 * SECOND)
  expect(said(session.started())).toEqual([['say', 'Claude is done']])
})

test('say-done: a turn of exactly 30 seconds stays quiet', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.turnEnd(30 * SECOND)
  expect(said(session.started())).toEqual([])
})

test('say-done: a short turn does not even look up the platform', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.turnEnd(2 * SECOND)
  expect(session.started()).toEqual([])
})

test('say-done: off on Linux', async ($, on) => {
  const session = probe($, on, { uname: 'Linux', onPath: { say: '/usr/bin/say' } })
  await session.turnEnd(90 * SECOND)
  expect(said(session.started())).toEqual([])
})

test('say-done: off where uname is missing (Windows), and quiet in the log', async ($, on) => {
  const session = probe($, on)
  await session.turnEnd(90 * SECOND)
  expect(said(session.started())).toEqual([])
  expect(session.logs()).toEqual([])
})

test('say-done: an interrupted turn stays quiet: the person is there', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.turnEnd(90 * SECOND, { isAborted: true })
  expect(said(session.started())).toEqual([])
})

test("say-done: a subagent's turn stays quiet", async ($, on) => {
  const session = probe($, on, { uname: 'Darwin' })
  await session.turnEnd(90 * SECOND, { agentId: 'a1' })
  expect(said(session.started())).toEqual([])
})

test('say-done: a failed say is logged and the turn still ends', async ($, on) => {
  const session = probe($, on, { uname: 'Darwin', format: () => ({ exitCode: 1 }) })
  await session.turnEnd(90 * SECOND)
  expect(session.logs()).toEqual(['say-done: skipped, say exited 1'])
})
