import { expect, test } from 'claude-code/testing'

import { bead, json, NO_PROJECT_ERR } from './bd-fixtures'
import { probe } from './probe'

const KEY = 'bd show bm-ooq.64 --include-dependents --json'
const USAGE = 'Usage: /bead <id>, for example /bead bm-ooq.64'

const FULL = bead('bm-ooq.64', {
  title: 'Add the thing',
  status: 'in_progress',
  priority: 1,
  issue_type: 'task',
  parent: 'bm-ooq',
  labels: ['gap-review', 'ui'],
  description: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n'),
  dependencies: [
    { ...bead('bm-ooq.60', { status: 'open' }), dependency_type: 'blocks' },
    { ...bead('bm-ooq', { status: 'open', issue_type: 'epic' }), dependency_type: 'parent-child' },
  ],
  dependents: [
    { ...bead('bm-ooq.70', { status: 'closed' }), dependency_type: 'parent-child' },
    { ...bead('bm-ooq.71', { status: 'open' }), dependency_type: 'blocks' },
  ],
})

test('bead: registers /bead with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'bead')?.description).toMatch(/one bead/i)
})

test('bead: prints the fields, 15 description lines, blockers and children', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([FULL]) } })
  const text = await session.run('bead', 'bm-ooq.64')
  expect(text).toContain('bm-ooq.64  Add the thing')
  expect(text).toContain('status: in_progress')
  expect(text).toContain('priority: P1')
  expect(text).toContain('type: task')
  expect(text).toContain('parent: bm-ooq')
  expect(text).toContain('labels: gap-review, ui')
  expect(text).toContain('line 15')
  expect(text).not.toContain('line 16\n')
  expect(text).toContain('... (5 more lines)')
  expect(text).toContain('Blocked by (1)\n  bm-ooq.60  open  Title of bm-ooq.60')
  expect(text).toContain('Children (1)\n  bm-ooq.70  closed  Title of bm-ooq.70')
  expect(text).not.toContain('bm-ooq.71')
  expect(session.copied()).toEqual([])
  expect(text).not.toMatch(/copied/)
})

test('bead: a bead with no parent, labels, blockers or children says none and omits the lists', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-ooq.64')]) } })
  const text = await session.run('bead', 'bm-ooq.64')
  expect(text).toContain('parent: none')
  expect(text).toContain('labels: none')
  expect(text).not.toMatch(/Blocked by|Children/)
})

test('bead: a missing or bad id prints the usage and never runs bd', async ($, on) => {
  const session = probe($, on)
  for (const args of ['', '--all', '-h', 'a b', 'x;rm', '.hidden', 'a'.repeat(65)]) expect(await session.run('bead', args)).toBe(USAGE)
  expect(session.ran()).toEqual([])
})

test('bead: an id may hold dots, dashes and underscores', async ($, on) => {
  const session = probe($, on, { git: { 'bd show A_b-1.2 --include-dependents --json': json([bead('A_b-1.2')]) } })
  expect(await session.run('bead', 'A_b-1.2')).toContain('A_b-1.2  Title of A_b-1.2')
})

test('bead: a long title is cut to one line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-ooq.64', { title: 'y'.repeat(300) })]) } })
  const first = (await session.run('bead', 'bm-ooq.64')).split('\n')[0] ?? ''
  expect(first.length).toBeLessThan(140)
  expect(first.endsWith('…')).toBe(true)
})

test('bead: an empty answer prints "bd did not answer."', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '[]' } })
  expect(await session.run('bead', 'bm-ooq.64')).toBe('bd did not answer.')
})

test('bead: bd missing prints "bd is not installed."', async ($, on) => {
  const session = probe($, on, { missing: [KEY] })
  expect(await session.run('bead', 'bm-ooq.64')).toBe('bd is not installed.')
})

test('bead: exit 1 outside a beads folder prints the no-project line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '' }, exit: { [KEY]: 1 }, stderr: { [KEY]: NO_PROJECT_ERR } })
  expect(await session.run('bead', 'bm-ooq.64')).toBe('No beads project in this folder.')
})

test('bead: JSON that does not parse prints "bd did not answer."', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: '{oops' } })
  expect(await session.run('bead', 'bm-ooq.64')).toBe('bd did not answer.')
})
