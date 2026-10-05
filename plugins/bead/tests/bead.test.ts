import { expect, test } from 'claude-code/testing'

import { bead, json, NO_PROJECT_ERR } from './bd-fixtures'
import { probe } from './probe'

const OWN = (id: string) => `bd list --id ${id} --all --json`
const KIDS = (id: string) => `bd list --parent ${id} --status all --json -n 0`
const KEY = OWN('bm-ooq.64')
const USAGE = 'Usage: /bead <id>, for example /bead bm-ooq.64'

// Edges as `bd list --json` gives them (real shape).
const edge = (from: string, to: string, type: string) => ({ issue_id: from, depends_on_id: to, type, created_at: '2026-10-05T17:59:08Z', metadata: '{}' })

const FULL = bead('bm-ooq.64', {
  title: 'Add the thing',
  status: 'in_progress',
  priority: 1,
  issue_type: 'task',
  parent: 'bm-ooq',
  labels: ['gap-review', 'ui'],
  description: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n'),
  dependencies: [edge('bm-ooq.64', 'bm-ooq.60', 'blocks'), edge('bm-ooq.64', 'bm-ooq', 'parent-child')],
})
const FAKES = {
  [KEY]: json([FULL]),
  [KIDS('bm-ooq.64')]: json([bead('bm-ooq.70', { status: 'closed' })]),
  [OWN('bm-ooq.60')]: json([bead('bm-ooq.60', { status: 'open' })]),
}

test('bead: registers /bead with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'bead')?.description).toMatch(/one bead/i)
})

test('bead: prints the fields, 15 description lines, blockers and children', async ($, on) => {
  const session = probe($, on, { git: FAKES })
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
  expect(session.ran()).toEqual([KEY, KIDS('bm-ooq.64'), OWN('bm-ooq.60')])
  expect(session.copied()).toEqual([])
  expect(text).not.toMatch(/copied/)
})

test('bead: a bead with no parent, labels, blockers or children says none and omits the lists', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-ooq.64')]), [KIDS('bm-ooq.64')]: '[]' } })
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
  const session = probe($, on, { git: { [OWN('A_b-1.2')]: json([bead('A_b-1.2')]), [KIDS('A_b-1.2')]: '[]' } })
  expect(await session.run('bead', 'A_b-1.2')).toContain('A_b-1.2  Title of A_b-1.2')
})

test('bead: a long title is cut to one line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([bead('bm-ooq.64', { title: 'y'.repeat(300) })]), [KIDS('bm-ooq.64')]: '[]' } })
  const first = (await session.run('bead', 'bm-ooq.64')).split('\n')[0] ?? ''
  expect(first.length).toBeLessThan(140)
  expect(first.endsWith('…')).toBe(true)
})

test('bead: a missing id (bd answers an empty list, exit 0) prints "No bead <id> in this project."', async ($, on) => {
  const session = probe($, on, { git: { [OWN('nosuch-1')]: '[]\n' } })
  expect(await session.run('bead', 'nosuch-1')).toBe('No bead nosuch-1 in this project.')
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

test('bead: never runs bd show, which writes .beads/last-touched', async ($, on) => {
  const session = probe($, on, { git: FAKES })
  await session.run('bead', 'bm-ooq.64')
  expect(session.ran().some(argv => argv.startsWith('bd show'))).toBe(false)
  expect(session.ran().every(argv => argv.startsWith('bd list '))).toBe(true)
})

test('bead: a failing children read prints one line', async ($, on) => {
  const session = probe($, on, { git: { [KEY]: json([FULL]), [KIDS('bm-ooq.64')]: 'oops' } })
  expect(await session.run('bead', 'bm-ooq.64')).toBe('bd did not answer.')
})
