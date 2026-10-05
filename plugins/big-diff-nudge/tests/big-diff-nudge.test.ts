import { expect, test } from 'claude-code/testing'

// Plain text files, so the other rules of quality-pack stay quiet here.
import { THRESHOLD } from '../hooks/rules/big-diff-nudge'
import { probe, FAIL_WORD } from './probe'

const lines = (count: number, prefix = 'l') => Array.from({ length: count }, (_, i) => `${prefix}${i}`).join('\n')
const NUDGE = (n: number) => `big-diff-nudge: ${n} lines changed since the last commit. Consider splitting this into smaller commits.`

test('big-diff-nudge: threshold is 500', () => {
  expect(THRESHOLD).toBe(500)
})

test('big-diff-nudge: 501 added lines give one toast', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(501))
  expect(await session.stop()).toEqual([NUDGE(501)])
})

test('big-diff-nudge: exactly 500 stays quiet', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(500))
  expect(await session.stop()).toEqual([])
})

test('big-diff-nudge: added and removed lines both count, across files', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(300))
  await session.edit('data/b.txt', lines(100, 'n'), lines(101, 'o'))
  expect(await session.stop()).toEqual([NUDGE(501)])
})

test('big-diff-nudge: unchanged lines inside an edit do not count', async ($, on) => {
  const session = probe($, on)
  await session.edit('data/a.txt', `${lines(600)}\nnew`, `${lines(600)}\nold`)
  expect(await session.stop()).toEqual([])
})

test('big-diff-nudge: it counts across turns until a commit', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(300))
  expect(await session.stop()).toEqual([])
  await session.write('data/b.txt', lines(300, 'm'))
  expect(await session.stop()).toEqual([NUDGE(600)])
})

test('big-diff-nudge: after a toast it stays quiet until 500 more lines pile up', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(600))
  await session.stop()
  expect(await session.stop()).toEqual([])
  await session.write('data/b.txt', lines(400, 'm'))
  expect(await session.stop()).toEqual([])
  await session.write('data/c.txt', lines(101, 'k'))
  expect(await session.stop()).toEqual([NUDGE(1101)])
})

test('big-diff-nudge: a successful git commit resets the count, a failed one does not', async ($, on) => {
  const session = probe($, on)
  await session.write('data/a.txt', lines(300))
  await session.bash('git commit -am x')
  await session.write('data/b.txt', lines(300, 'm'))
  expect(await session.stop()).toEqual([])
  await session.bash(`git commit -m ${FAIL_WORD}`)
  await session.write('data/c.txt', lines(300, 'k'))
  expect(await session.stop()).toEqual([NUDGE(600)])
})

test('big-diff-nudge: a Write over an existing file counts only the lines it changed', async ($, on) => {
  const session = probe($, on)
  const original = lines(600)
  await session.write('data/a.txt', original.replace('l7\n', 'changed\n'), original)
  expect(await session.stop()).toEqual([])
})
