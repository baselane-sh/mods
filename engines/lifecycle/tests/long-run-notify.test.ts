import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const CWD = '/work/myproj'
const SECOND = 1000

test('long-run-notify: pings when a command ran over the threshold', { options: { ntfyTopic: 't-9', longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.bash('pnpm build', 100 * SECOND)
  expect(session.fetched()).toEqual([
    { url: 'https://ntfy.sh/t-9', method: 'POST', headers: { Title: 'Claude Code' }, body: 'Long command finished (myproj, 100s)' },
  ])
})

test('long-run-notify: never sends the command text', { options: { ntfyTopic: 't-9', longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.bash('pnpm build --secret-flag', 100 * SECOND)
  expect(JSON.stringify(session.fetched())).not.toContain('pnpm')
  expect(JSON.stringify(session.fetched())).not.toContain('secret-flag')
})

test('long-run-notify: below the threshold, no ping', { options: { ntfyTopic: 't-9', longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.bash('ls', 5 * SECOND)
  expect(session.fetched()).toEqual([])
})

test('long-run-notify: no topic, no ping', { options: { longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.bash('sleep 100', 100 * SECOND)
  expect(session.fetched()).toEqual([])
})

test('long-run-notify: the default threshold is 60 seconds, met at 60', { options: { ntfyTopic: 't-9' } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.bash('a', 59 * SECOND)
  expect(session.fetched()).toEqual([])
  await session.bash('b', 60 * SECOND)
  expect(session.fetched().length).toBe(1)
})

test('long-run-notify: only Bash counts', { options: { ntfyTopic: 't-9', longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD })
  await session.edit('/work/myproj/a.ts', 100 * SECOND)
  expect(session.fetched()).toEqual([])
})

test('long-run-notify: a refused push does not break the tool result', { options: { ntfyTopic: 't-9', longRunSecs: 30 } }, async ($, on) => {
  const session = probe($, on, { cwd: CWD, ntfyStatus: 500 })
  const ran = await session.bash('make', 100 * SECOND)
  expect(ran.deny).toBeUndefined()
  expect(session.fetched().length).toBe(1)
})
