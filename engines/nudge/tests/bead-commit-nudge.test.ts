import { expect, test } from 'claude-code/testing'

import { namesBead } from '../hooks/beads'
import { reminder } from '../hooks/rules/bead-commit-nudge'
import { probe } from './probe'
import type { RunFake } from './probe'

const count = (n: number): RunFake => ({ exitCode: 0, stdout: `{"count":${n},"schema_version":1}` })
const where = (prefix: string): RunFake => ({ exitCode: 0, stdout: `{"database_path":"/r/.beads/embeddeddolt","path":"/r/.beads","prefix":"${prefix}","schema_version":1}` })
const bd = (inProgress: RunFake, prefix: RunFake = where('bm')) => (argv: readonly string[]): RunFake =>
  argv[0] !== 'bd' ? { exitCode: 1 } : argv[1] === 'count' ? inProgress : argv[1] === 'where' ? prefix : { exitCode: 1 }
const NUDGE = (n = 1) => `bead-commit-nudge: ${reminder(n)}`

test('bead-commit-nudge: a commit that names no bead, with a bead in progress, is reminded', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git commit -m "fix the thing"')
  expect(await session.stop()).toContain(NUDGE())
  expect(await session.stop()).not.toContain(NUDGE()) // each commit once
  expect(session.ran().map(r => r.argv.join(' '))).toEqual(['bd count --status in_progress --json', 'bd where --json'])
})

test('bead-commit-nudge: a commit that names a bead is quiet', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git add -A && git commit -m "bm-ooq.64: fix the thing"')
  expect(await session.stop()).toEqual([])
})

test('bead-commit-nudge: a heredoc message that names a bead is quiet', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git commit -m "$(cat <<\'EOF\'\nfix: x (bm-ab1c)\nEOF\n)"')
  expect(await session.stop()).toEqual([])
})

test('bead-commit-nudge: two unnamed commits give one line with the count', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(3)))
  await session.bash('git commit -m a')
  await session.bash('cd sub && git commit -m b')
  expect(await session.stop()).toContain(NUDGE(2))
})

test('bead-commit-nudge: no bead in progress is quiet', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(0)))
  await session.bash('git commit -m "x"')
  expect(await session.stop()).toEqual([])
})

test('bead-commit-nudge: a failed commit and other git commands do not count', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git commit -m "x" FAILME')
  await session.bash('git log')
  await session.bash('echo git commit')
  expect(await session.stop()).toEqual([])
  expect(session.ran()).toEqual([])
})

test('bead-commit-nudge: an id with another prefix does not count as named', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1), where('bm')))
  await session.bash('git commit -m "xbm-abc and abm-1 and other-abc"')
  expect(await session.stop()).toContain(NUDGE())
})

const QUIET: ReadonlyArray<readonly [string, ReturnType<typeof bd>]> = [
  ['bd missing', () => 'missing'],
  ['no beads project', argv => (argv[0] === 'bd' ? { exitCode: 1, stderr: 'Error: no beads database found' } : { exitCode: 1 })],
  ['empty output', () => ({ exitCode: 0, stdout: '' })],
  ['text that is not JSON', () => ({ exitCode: 0, stdout: 'nope' })],
  ['an empty array', () => ({ exitCode: 0, stdout: '[]' })],
  ['a prefix that is not an id prefix', bd(count(1), where('bad prefix; rm'))],
  ['a long prefix', bd(count(1), where('p'.repeat(300)))],
  ['no prefix', bd(count(1), { exitCode: 0, stdout: '{"path":"/r"}' })],
]
for (const [name, fake] of QUIET) {
  test(`bead-commit-nudge: ${name} stays quiet and logs nothing`, async ($, on) => {
    const session = probe($, on, 10, 'x', fake)
    await session.bash('git commit -m "x"')
    expect(await session.stop()).toEqual([])
    expect(session.logs()).toEqual([])
  })
}

test('bead-commit-nudge: id table', () => {
  for (const text of ['bm-a', 'fix bm-ooq.64 now', '(bm-ab1.2.3)', 'bm-x\nmore']) expect({ text, named: namesBead(text, 'bm') }).toEqual({ text, named: true })
  for (const text of ['bm-', 'bm', 'xbm-a', 'bm_a', 'b.m-a']) expect({ text, named: namesBead(text, 'bm') }).toEqual({ text, named: false })
  expect(namesBead('bXm-a', 'b.m')).toBe(false) // the prefix is text, not a pattern
})

test('bead-commit-nudge: the next prompt carries the reminder as a note, once, with no commit text', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git commit -m "secret message text"')
  await session.stop()
  expect(await session.prompt()).toEqual([reminder(1)])
  expect(await session.prompt()).toEqual([])
})

test('bead-commit-nudge: no reminder, no note', async ($, on) => {
  const session = probe($, on, 10, 'x', bd(count(1)))
  await session.bash('git commit -m "bm-a: x"')
  await session.stop()
  expect(await session.prompt()).toEqual([])
})
