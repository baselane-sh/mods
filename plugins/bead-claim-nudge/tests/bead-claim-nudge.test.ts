import { expect, test } from 'claude-code/testing'

import { REMINDER } from '../hooks/rules/bead-claim-nudge'
import { probe } from './probe'
import type { RunFake } from './probe'

const REMINDED = `bead-claim-nudge: ${REMINDER}`
const count = (n: number): RunFake => ({ exitCode: 0, stdout: `{\n  "count": ${n},\n  "schema_version": 1\n}\n` })
const bdWith = (answer: RunFake) => (argv: readonly string[]) => (argv[0] === 'bd' ? answer : { exitCode: 1 })

test('bead-claim-nudge: reminds once per session after an edit with no bead in progress', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.write('src/app.ts')
  expect(await session.stop()).toContain(REMINDED)
  await session.edit('src/app.ts')
  expect(await session.stop()).not.toContain(REMINDED)
})

test('bead-claim-nudge: reads with the counting command, in the session folder, and nothing that writes', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.write('src/app.ts')
  await session.stop()
  expect(session.ran()).toEqual([{ argv: ['bd', 'count', '--status', 'in_progress', '--json'], cwd: '/repo' }])
})

test('bead-claim-nudge: a bead in progress keeps it quiet', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(2)))
  await session.write('src/app.ts')
  expect(await session.stop()).not.toContain(REMINDED)
})

test('bead-claim-nudge: no edit, no look at bd', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.bash('ls')
  expect(await session.stop()).not.toContain(REMINDED)
  expect(session.ran()).toEqual([])
})

test('bead-claim-nudge: a failed edit does not count', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.bash('FAILME')
  expect(await session.stop()).toEqual([])
  expect(session.ran()).toEqual([])
})

test('bead-claim-nudge: an edit in an earlier turn does not count in a later one', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(2)))
  await session.write('src/app.ts')
  await session.stop()
  expect(session.ran().length).toBe(1)
  await session.stop()
  expect(session.ran().length).toBe(1)
})

const QUIET: ReadonlyArray<readonly [string, RunFake]> = [
  ['bd missing', 'missing'],
  ['no beads project', { exitCode: 1, stderr: 'Error: no beads database found' }],
  ['empty output', { exitCode: 0, stdout: '' }],
  ['text that is not JSON', { exitCode: 0, stdout: 'not json' }],
  ['an empty array', { exitCode: 0, stdout: '[]' }],
  ['a count that is not a number', { exitCode: 0, stdout: '{"count":"many"}' }],
]
for (const [name, answer] of QUIET) {
  test(`bead-claim-nudge: ${name} stays quiet and logs nothing`, async ($, on) => {
    const session = probe($, on, 10, 'x', bdWith(answer))
    await session.write('src/app.ts')
    expect(await session.stop()).toEqual([])
    expect(session.logs()).toEqual([])
  })
}

test('bead-claim-nudge: a long file name does not matter', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.write(`src/${'a'.repeat(300)}.ts`)
  expect(await session.stop()).toContain(REMINDED)
})

test('bead-claim-nudge: the next prompt carries the reminder as a note, once', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(0)))
  await session.write('src/app.ts')
  await session.stop()
  expect(await session.prompt()).toEqual([REMINDER])
  expect(await session.prompt()).toEqual([])
})

test('bead-claim-nudge: no reminder, no note', async ($, on) => {
  const session = probe($, on, 10, 'x', bdWith(count(2)))
  await session.write('src/app.ts')
  await session.stop()
  expect(await session.prompt()).toEqual([])
})
