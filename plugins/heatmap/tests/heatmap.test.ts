import { expect, test } from 'claude-code/testing'

import { at, day, probe } from './probe'

const EMPTY_ROW = (name: string) => `${name} ${Array(12).fill('·').join(' ')}`

// TODAY is Sunday 2026-10-04, so the grid's last column is the full week from
// Monday 2026-09-28, and its first column the week from Monday 2026-07-13.
const DAYS = {
  '2026-07-12': day({ sessions: 1, turns: 99 }),
  '2026-07-14': day({ sessions: 1, turns: 2 }),
  '2026-09-01': day({ sessions: 1, turns: 15 }),
  '2026-09-29': day({ sessions: 2, turns: 30 }),
  '2026-09-30': day({ sessions: 1, turns: 0 }),
  '2026-10-04': day({ sessions: 1, turns: 8 }),
}

test('heatmap: registers /heatmap with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('heatmap')
})

test('heatmap: a 12 week grid, Monday first, shaded by turns, with the busiest day named', async ($, on) => {
  const session = probe($, on, { store: { days: DAYS } })
  expect(await session.run('heatmap')).toBe(
    [
      'Active days, last 12 weeks: 4',
      '        Aug       Sep     Oct',
      EMPTY_ROW('Mon'),
      'Tue ░ · · · · · · ▒ · · · █',
      EMPTY_ROW('Wed'),
      EMPTY_ROW('Thu'),
      EMPTY_ROW('Fri'),
      EMPTY_ROW('Sat'),
      'Sun · · · · · · · · · · · ▒',
      'less · ░ ▒ ▓ █ more',
      'Busiest day: Tue 2026-09-29, 30 turns',
    ].join('\n'),
  )
})

test('heatmap: midweek, the days after today are left blank', async ($, on) => {
  const session = probe($, on, { now: at(2026, 9, 30), store: { days: { '2026-09-30': day({ turns: 3 }) } } })
  const rows = (await session.run('heatmap')).split('\n')
  expect(rows.find(row => row.startsWith('Wed'))).toBe('Wed · · · · · · · · · · · █')
  expect(rows.find(row => row.startsWith('Thu'))).toBe('Thu · · · · · · · · · · ·')
  expect(rows.find(row => row.startsWith('Sun'))).toBe('Sun · · · · · · · · · · ·')
})

test('heatmap: on a tie the later day is the busiest', async ($, on) => {
  const session = probe($, on, { store: { days: { '2026-09-01': day({ turns: 5 }), '2026-09-02': day({ turns: 5 }) } } })
  expect((await session.run('heatmap')).split('\n').at(-1)).toBe('Busiest day: Wed 2026-09-02, 5 turns')
})

test('heatmap: a day with a session but no turn is not active', async ($, on) => {
  const session = probe($, on, { store: { days: { '2026-10-01': day({ sessions: 3, calls: 9 }) } } })
  const text = await session.run('heatmap')
  expect(text.split('\n')[0]).toBe('Active days, last 12 weeks: 0')
  expect(text.split('\n').at(-1)).toBe('No active day yet. A day counts once it has a turn.')
})

test('heatmap: a turn now shows on today', async ($, on) => {
  const session = probe($, on)
  await session.start()
  await session.turn()
  const text = await session.run('heatmap')
  expect(text.split('\n').find(row => row.startsWith('Sun'))).toBe('Sun · · · · · · · · · · · █')
  expect(text.split('\n').at(-1)).toBe('Busiest day: Sun 2026-10-04, 1 turn')
})
