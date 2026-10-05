import { expect, test } from 'claude-code/testing'

import { bead, json, NO_PROJECT_ERR } from './bd-fixtures'
import { probe } from './probe'

const yesterday = (): string => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
}
const closedKey = () => `bd list --status closed --closed-after ${yesterday()} --json -n 0`
const DOING = 'bd list --status in_progress --json -n 0'
const READY = 'bd ready --json -n 0'

const answers = (closed: unknown[], doing: unknown[], ready: unknown[]) => ({
  [closedKey()]: json(closed),
  [DOING]: json(doing),
  [READY]: json(ready),
})

test('beads-standup: registers /beads-standup with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered().find(c => c.name === 'beads-standup')?.description).toMatch(/closed since yesterday/i)
})

test('beads-standup: three lists, the ready list cut to 5 by priority then oldest', async ($, on) => {
  const ready = Array.from({ length: 8 }, (_, i) => bead(`bm-r${i}`, { priority: i === 7 ? 0 : 2, created_at: `2026-10-0${i + 1}T00:00:00Z` }))
  const session = probe($, on, { git: answers([bead('bm-d1', { status: 'closed' })], [bead('bm-p1', { status: 'in_progress' })], ready) })
  const text = await session.run('beads-standup')
  expect(text).toBe(
    [
      'Closed since yesterday (1)',
      '  bm-d1  P1  Title of bm-d1',
      '',
      'In progress (1)',
      '  bm-p1  P1  Title of bm-p1',
      '',
      'Next 5 ready (5)',
      '  bm-r7  P0  Title of bm-r7',
      '  bm-r0  P2  Title of bm-r0',
      '  bm-r1  P2  Title of bm-r1',
      '  bm-r2  P2  Title of bm-r2',
      '  bm-r3  P2  Title of bm-r3',
    ].join('\n'),
  )
})

test('beads-standup: closed-after is the local start of yesterday, and only read commands run', async ($, on) => {
  const session = probe($, on, { git: answers([], [], []) })
  await session.run('beads-standup')
  expect(session.ran()).toEqual([closedKey(), DOING, READY])
})

test('beads-standup: empty lists read as none', async ($, on) => {
  const session = probe($, on, { git: answers([], [], []) })
  const text = await session.run('beads-standup')
  expect(text).toBe(['Closed since yesterday (0)', '  none', '', 'In progress (0)', '  none', '', 'Next 5 ready (0)', '  none'].join('\n'))
})

test('beads-standup: a long list is cut with a count, and copies nothing', async ($, on) => {
  const closed = Array.from({ length: 20 }, (_, i) => bead(`bm-c${i}`, { status: 'closed' }))
  const session = probe($, on, { git: answers(closed, [], []) })
  const text = await session.run('beads-standup')
  expect(text).toContain('Closed since yesterday (20)')
  expect(text).toContain('  +5 more')
  expect(session.copied()).toEqual([])
  expect(text).not.toMatch(/copied/)
})

test('beads-standup: a long title is cut to one line', async ($, on) => {
  const session = probe($, on, { git: answers([bead('bm-a', { title: `${'z'.repeat(200)}\nmore` })], [], []) })
  const line = (await session.run('beads-standup')).split('\n')[1] ?? ''
  expect(line.length).toBeLessThan(100)
  expect(line.endsWith('…')).toBe(true)
})

test('beads-standup: bd missing prints "bd is not installed."', async ($, on) => {
  const session = probe($, on, { missing: [closedKey()] })
  expect(await session.run('beads-standup')).toBe('bd is not installed.')
})

test('beads-standup: exit 1 outside a beads folder prints the no-project line', async ($, on) => {
  const session = probe($, on, { git: { [closedKey()]: '' }, exit: { [closedKey()]: 1 }, stderr: { [closedKey()]: NO_PROJECT_ERR } })
  expect(await session.run('beads-standup')).toBe('No beads project in this folder.')
})

test('beads-standup: JSON that does not parse in a later call prints "bd did not answer."', async ($, on) => {
  const session = probe($, on, { git: { ...answers([], [], []), [DOING]: 'nope' } })
  expect(await session.run('beads-standup')).toBe('bd did not answer.')
})
