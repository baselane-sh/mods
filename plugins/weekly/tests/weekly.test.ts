import { expect, test } from 'claude-code/testing'

import { at, day, probe } from './probe'

// TODAY is Sunday 2026-10-04: this week is Monday 2026-09-28 to today, last
// week Monday 2026-09-21 to Sunday 2026-09-27.
const DAYS = {
  '2026-09-20': day({ sessions: 9, turns: 99, calls: 999, files: 99, usd: 99 }),
  '2026-09-21': day({ sessions: 5, turns: 22, calls: 410, files: 9, usd: 8.25 }),
  '2026-09-28': day({ sessions: 1, turns: 10, calls: 100, files: 4, usd: 2.5 }),
  '2026-10-04': day({ sessions: 2, turns: 30, calls: 200, files: 8, usd: 10 }),
}

test('weekly: registers /week with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('week')
})

test('weekly: this week against last week, Monday first, with the change', async ($, on) => {
  const session = probe($, on, { store: { days: DAYS } })
  expect(await session.run('week')).toBe(
    [
      'This week (since Mon 2026-09-28) against last week',
      '              this week  last week     change',
      'sessions              3          5         -2',
      'turns                40         22        +18',
      'tool calls          300        410       -110',
      'files edited         12          9         +3',
      'cost             $12.50      $8.25     +$4.25',
    ].join('\n'),
  )
})

test('weekly: midweek, this week runs from Monday to today', async ($, on) => {
  const session = probe($, on, { now: at(2026, 9, 30), store: { days: DAYS } })
  const lines = (await session.run('week')).split('\n')
  expect(lines[0]).toBe('This week (since Mon 2026-09-28) against last week')
  expect(lines[2]).toBe('sessions              1          5         -4')
})

test('weekly: a week with no cost reading shows ?, and no change is 0', async ($, on) => {
  const days = { '2026-09-22': day({ sessions: 1, turns: 3, calls: 7 }), '2026-09-29': day({ sessions: 1, turns: 3, calls: 7 }) }
  const session = probe($, on, { store: { days } })
  const lines = (await session.run('week')).split('\n')
  expect(lines[2]).toBe('sessions              1          1          0')
  expect(lines[6]).toBe('cost                  ?          ?          ?')
})

test('weekly: a cost that fell reads with a minus sign', async ($, on) => {
  const days = { '2026-09-22': day({ usd: 3 }), '2026-09-29': day({ usd: 1.75 }) }
  const session = probe($, on, { store: { days } })
  expect((await session.run('week')).split('\n')[6]).toBe('cost              $1.75      $3.00     -$1.25')
})

test('weekly: a live session adds to this week', async ($, on) => {
  const session = probe($, on, { usd: 0 })
  await session.start()
  await session.bash('ls')
  await session.write('/repo/a.ts')
  await session.turn(0.5)
  const lines = (await session.run('week')).split('\n')
  expect(lines.slice(2)).toEqual([
    'sessions              1          0         +1',
    'turns                 1          0         +1',
    'tool calls            2          0         +2',
    'files edited          1          0         +1',
    'cost              $0.50          ?          ?',
  ])
})
