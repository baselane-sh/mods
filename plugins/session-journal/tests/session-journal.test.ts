import { expect, test } from 'claude-code/testing'

import { probe } from './probe'

const NOW = 1_700_000_000_000
const LOG = '/home/me/.claude/journal.log'

// The journal stamps local time, so the expectation builds it the same way.
const stamp = (ms: number): string => {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`
}

test('session-journal: writes one line per session end', async ($, on) => {
  const session = probe($, on, { home: '/home/me', now: NOW })
  await session.sessionEnd('other', '/work/myproj')
  expect(session.files().get(LOG)).toBe(`${stamp(NOW)} | /work/myproj | other\n`)
})

test('session-journal: appends and keeps earlier lines', async ($, on) => {
  const session = probe($, on, { home: '/home/me', now: NOW, files: { [LOG]: 'old line\n' } })
  await session.sessionEnd('clear', '/work/b')
  expect(session.files().get(LOG)).toBe(`old line\n${stamp(NOW)} | /work/b | clear\n`)
})

test('session-journal: without a home directory nothing is written', async ($, on) => {
  const session = probe($, on, { now: NOW })
  await session.sessionEnd()
  expect([...session.files().keys()]).toEqual([])
})
