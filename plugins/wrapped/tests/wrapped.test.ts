import { expect, test } from 'claude-code/testing'

import { TODAY, day, probe } from './probe'

const SIGNATURE = 'made with Claude Code + baselane.sh'

// Mon 09-28 .. Sun 10-04 is the week. 09-30 is a gap and today is empty, so
// the longest run is 10-01 to 10-03 (3 days). 09-20 is outside the week.
// 09-27 is just outside the week; 09-05 is the first day of the month and
// 09-04 just outside it.
const HISTORY = {
  '2026-09-04': day({ sessions: 1, calls: 100, tools: { Zed: 100 } }),
  '2026-09-05': day({ sessions: 1, calls: 3, tools: { Zed: 3 } }),
  '2026-09-20': day({ sessions: 5, turns: 50, calls: 900, files: 40, passed: 9, failed: 9, blocked: 9, usd: 20, tools: { Grep: 900 } }),
  '2026-09-27': day({ sessions: 1, calls: 7, tools: { Zed: 7 } }),
  '2026-09-28': day({ sessions: 1, turns: 10, calls: 120, files: 8, passed: 2, failed: 1, usd: 1.5, tools: { Bash: 70, Read: 30, Edit: 20 } }),
  '2026-09-29': day({ sessions: 2, turns: 30, calls: 410, files: 25, passed: 5, failed: 2, blocked: 3, usd: 6.25, tools: { Bash: 200, Read: 150, Edit: 60 } }),
  '2026-10-01': day({ sessions: 1, turns: 12, calls: 90, files: 6, passed: 3, usd: 0.75, tools: { Bash: 50, Read: 40 } }),
  '2026-10-02': day({ sessions: 1, turns: 8, calls: 60, files: 4, passed: 1, failed: 1, blocked: 1, usd: 0.5, tools: { Bash: 30, Read: 30 } }),
  '2026-10-03': day({ sessions: 1, turns: 5, calls: 40, files: 2, blocked: 1, usd: 0.25, tools: { Read: 25, Bash: 15 } }),
}

const WEEK = [
  '====================================',
  '        CLAUDE CODE WRAPPED',
  '            last 7 days',
  '====================================',
  'sessions                           6',
  'turns                             65',
  'tool calls                       720',
  'files touched                     45',
  'tests passed                      11',
  'tests failed                       4',
  'blocked calls                      5',
  '------------------------------------',
  'busiest day     Tue 09-29, 410 calls',
  'top tool                  Bash (365)',
  'longest streak                3 days',
  'cost                           $9.25',
  '====================================',
  SIGNATURE,
].join('\n')

test('wrapped: registers /wrapped with a description', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.registered()).toContain('wrapped')
})

test('wrapped: the week, exactly, copied to the clipboard', async ($, on) => {
  const session = probe($, on, { store: { days: HISTORY } })
  const text = await session.run('wrapped')
  expect(session.copied()).toEqual([WEEK])
  expect(text).toBe(`${WEEK}\n\ncopied to clipboard`)
  expect(session.copied()[0]?.split('\n').at(-1)).toBe(SIGNATURE)
})

test('wrapped: month reaches 30 days back and says so', async ($, on) => {
  const session = probe($, on, { store: { days: HISTORY } })
  await session.run('wrapped', 'month')
  const card = session.copied()[0] ?? ''
  expect(card).toContain('last 30 days')
  expect(card).toMatch(/sessions\s+13\n/)
  expect(card).toMatch(/tool calls\s+1630\n/)
  expect(card).toMatch(/top tool\s+Grep \(900\)/)
  expect(card).toMatch(/busiest day\s+Sun 09-20, 900 calls/)
  expect(card.split('\n').at(-1)).toBe(SIGNATURE)
})

test('wrapped: the cost row is left out when no day has a cost', async ($, on) => {
  const free = Object.fromEntries(Object.entries(HISTORY).map(([date, d]) => [date, { ...d, usd: undefined }]))
  const session = probe($, on, { store: { days: free } })
  await session.run('wrapped')
  expect(session.copied()[0]).not.toMatch(/cost/)
  expect(session.copied()[0]).toMatch(/tool calls\s+720/)
})

test('wrapped: an empty store prints zeros and still ends with the signature', async ($, on) => {
  const session = probe($, on)
  const text = await session.run('wrapped')
  expect(text).toMatch(/sessions\s+0\n/)
  expect(text).toMatch(/busiest day\s+none/)
  expect(text).toMatch(/top tool\s+none/)
  expect(text).toMatch(/longest streak\s+0 days/)
  expect(session.copied()[0]?.split('\n').at(-1)).toBe(SIGNATURE)
})

test('wrapped: a one day streak says day, not days', async ($, on) => {
  const session = probe($, on, { store: { days: { [TODAY]: day({ turns: 1, calls: 1 }) } } })
  await session.run('wrapped')
  expect(session.copied()[0]).toMatch(/longest streak\s+1 day\n/)
})

test('wrapped: an unknown option is explained and nothing is copied', async ($, on) => {
  const session = probe($, on, { store: { days: HISTORY } })
  const text = await session.run('wrapped', 'year')
  expect(text).toMatch(/\/wrapped month/)
  expect(session.copied()).toEqual([])
})

test('wrapped: week and a blank argument are the same', async ($, on) => {
  const session = probe($, on, { store: { days: HISTORY } })
  await session.run('wrapped', ' week ')
  await session.run('wrapped')
  expect(session.copied()[0]).toBe(session.copied()[1])
})

test('wrapped: every line fits 36 columns, and there are no em-dashes', async ($, on) => {
  const session = probe($, on, { store: { days: HISTORY } })
  await session.run('wrapped')
  await session.run('wrapped', 'month')
  for (const card of session.copied()) {
    expect(card).not.toContain(String.fromCharCode(0x2014))
    expect(card.split('\n').filter(line => line.length > 36)).toEqual([])
  }
})
