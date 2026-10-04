import { expect, test } from 'claude-code/testing'

import { GIT_COMMIT, THRESHOLD } from '../hooks/rules/commit-nudge'
import { probe, FAIL_WORD } from './probe'

const NUDGE = (n: number) => `commit-nudge: ${n} file edits since the last commit. Consider committing.`

const editFiles = async (session: ReturnType<typeof probe>, count: number) => {
  for (let i = 0; i < count; i += 1) await session.edit(`src/f${i}.ts`)
}

test('commit-nudge: threshold is 8', () => {
  expect(THRESHOLD).toBe(8)
})

test('commit-nudge: 8 edits give one toast at turn end', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 8)
  expect(await session.stop()).toEqual([NUDGE(8)])
})

test('commit-nudge: 7 edits stay quiet', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 7)
  expect(await session.stop()).toEqual([])
})

test('commit-nudge: it does not repeat next turn until 8 more edits pile up', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 8)
  await session.stop()
  expect(await session.stop()).toEqual([])
  await editFiles(session, 7)
  expect(await session.stop()).toEqual([])
  await session.edit('src/more.ts')
  expect(await session.stop()).toEqual([NUDGE(16)])
})

test('commit-nudge: a git commit resets the count', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 6)
  await session.bash('git add -A && git commit -m x')
  await editFiles(session, 6)
  expect(await session.stop()).toEqual([])
})

test('commit-nudge: a failed or denied commit does not reset', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 8)
  await session.bash(`git commit -m ${FAIL_WORD}`)
  expect(await session.stop()).toEqual([NUDGE(8)])
})

test('commit-nudge: Write counts as an edit, a read-only Bash does not', async ($, on) => {
  const session = probe($, on)
  await editFiles(session, 4)
  for (let i = 0; i < 4; i += 1) await session.write(`src/w${i}.ts`)
  await session.bash('git log')
  expect(await session.stop()).toEqual([NUDGE(8)])
})

test('commit-nudge: only a real git commit command matches', () => {
  for (const command of ['git commit -m x', 'git add . && git commit -am y', 'git -C /repo commit']) {
    expect({ command, hit: GIT_COMMIT.test(command) }).toEqual({ command, hit: true })
  }
  for (const command of ['echo git commit', 'git log', 'git commit-graph write']) {
    expect({ command, hit: GIT_COMMIT.test(command) }).toEqual({ command, hit: false })
  }
})
