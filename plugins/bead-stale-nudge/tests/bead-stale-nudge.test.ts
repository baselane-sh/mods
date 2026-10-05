import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { staleIds, toastText } from '../hooks/rules/bead-stale-nudge'
import { probe } from './probe'
import type { Formatted } from './probe'

const stale = (...ids: string[]): Formatted => ({ exitCode: 0, stdout: JSON.stringify(ids.map(id => ({ id, title: `t ${id}`, status: 'in_progress' }))) })
const bd = (answer: Formatted | 'missing') => (argv: readonly string[]): Formatted => {
  if (argv[0] !== 'bd') return { exitCode: 1 }
  if (answer === 'missing') throw new Error('bd: no such program')
  return answer
}

const toasts = (on: Parameters<TestBody>[1]) => {
  let seen: string[] = []
  on('ui.toast', (_$, e) => {
    seen = [...seen, e.text]
    return { value: undefined }
  })
  return () => seen
}
// The rule runs beside the session start, so let it finish.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

test('bead-stale-nudge: one toast naming the stale beads', async ($, on) => {
  const seen = toasts(on)
  const session = probe($, on, { format: bd(stale('bm-a', 'bm-b', 'bm-c')) })
  await session.sessionStart()
  await settle()
  expect(seen()).toEqual(['3 beads in progress have had no update for 7 days: bm-a, bm-b, bm-c'])
  expect(session.runs()).toEqual([{ argv: ['bd', 'stale', '--days', '7', '--status', 'in_progress', '--limit', '500', '--json'], cwd: '/repo' }])
})

test('bead-stale-nudge: one bead reads in the singular, many are cut', async ($, on) => {
  expect(toastText(['bm-a'])).toBe('1 bead in progress has had no update for 7 days: bm-a')
  expect(toastText(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('7 beads in progress have had no update for 7 days: a, b, c, d, e and 2 more')
})

const QUIET: ReadonlyArray<readonly [string, Formatted | 'missing']> = [
  ['bd missing', 'missing'],
  ['no beads project', { exitCode: 1, stderr: 'Error: no beads database found' }],
  ['empty output', { exitCode: 0, stdout: '' }],
  ['an empty array', { exitCode: 0, stdout: '[]' }],
  ['text that is not JSON', { exitCode: 0, stdout: 'oops' }],
  ['JSON that is not a list', { exitCode: 0, stdout: '{"id":"bm-a"}' }],
  ['items with no usable id', { exitCode: 0, stdout: '[{"id":"bad id; x"},{"title":"t"},3,null]' }],
]
for (const [name, answer] of QUIET) {
  test(`bead-stale-nudge: ${name} shows nothing and logs nothing`, async ($, on) => {
    const seen = toasts(on)
    const session = probe($, on, { format: bd(answer) })
    await session.sessionStart()
    await settle()
    expect(seen()).toEqual([])
    expect(session.logs()).toEqual([])
  })
}

test('bead-stale-nudge: an id table and a long title that never reaches the toast', async ($, on) => {
  expect(staleIds('[{"id":"bm-ooq.64","title":"x"},{"id":"-rf"},{"id":"a b"}]')).toEqual(['bm-ooq.64'])
  const seen = toasts(on)
  const long = { exitCode: 0, stdout: JSON.stringify([{ id: 'bm-a', title: 'T'.repeat(5000) }]) }
  const session = probe($, on, { format: bd(long) })
  await session.sessionStart()
  await settle()
  expect(seen()).toEqual(['1 bead in progress has had no update for 7 days: bm-a'])
})
