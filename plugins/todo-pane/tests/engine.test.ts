import { expect, test } from 'claude-code/testing'

import { waitBeforeLoad } from '../hooks/engine'
import { clean, durationText, redactLines } from '../hooks/lines'
import { MAX_FILES, touchFile } from '../hooks/files'
import { MAX_TURNS, countTool, endTurn, startTurn } from '../hooks/turns'

// Spliced so this file does not match the shapes it carries.
const KEYS = ['sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz', 'AKIA' + 'ABCDEFGHIJKLMNOP', 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789']

test('pane engine: every cell of every line is redacted, keys and colors kept', () => {
  const lines = [{ key: `file-${KEYS[0]}`, cells: KEYS.map(key => ({ text: `token ${key} end`, color: 'red' })) }]
  const redacted = redactLines(lines)
  expect(redacted[0]?.key).toBe('file-[REDACTED]')
  expect(redacted[0]?.cells).toEqual(KEYS.map(() => ({ text: 'token [REDACTED] end', color: 'red' })))
  expect(lines[0]?.cells[0]?.text).toContain(KEYS[0] ?? '')
})

test('pane engine: a load waits out the rest of a second since the last one', () => {
  expect(waitBeforeLoad(undefined, 5_000)).toBe(0)
  expect(waitBeforeLoad(5_000, 5_000)).toBe(1_000)
  expect(waitBeforeLoad(5_000, 5_400)).toBe(600)
  expect(waitBeforeLoad(5_000, 6_000)).toBe(0)
  expect(waitBeforeLoad(5_000, 9_000)).toBe(0)
})

test('pane engine: control characters and color codes are cleaned out of drawn text', () => {
  expect(clean('\u001b[31mred\u001b[0m\tthen')).toBe('red then')
})

test('pane engine: durations read in words', () => {
  expect(durationText(379)).toBe('379 ms')
  expect(durationText(1_500)).toBe('1.5 s')
  expect(durationText(125_000)).toBe('2 min 5 s')
})

test('pane engine: a turn costs the session cost at its end less the cost at its start', () => {
  const started = startTurn([], 't1', 0.5)
  expect(started).toEqual([{ turnId: 't1', n: 1, startUsd: 0.5, ended: false }])
  expect(startTurn(started, 't1', 0.9)).toEqual(started)
  expect(endTurn(started, 't1', 0.75)).toEqual([{ turnId: 't1', n: 1, startUsd: 0.5, ended: true, usd: 0.25 }])
  expect(endTurn(endTurn(started, 't1', 0.75), 't1', 2)[0]?.usd).toBe(0.25)
  expect(started[0]?.ended).toBe(false)
})

test('pane engine: an unknown or falling cost leaves a turn unmeasured, and an unseen turn is ignored', () => {
  expect(endTurn(startTurn([], 't1', undefined), 't1', 1)[0]).toEqual({ turnId: 't1', n: 1, startUsd: null, ended: true })
  expect(endTurn(startTurn([], 't1', 2), 't1', 0.1)[0]?.usd).toBeUndefined()
  expect(endTurn(startTurn([], 't1', 0), 't2', 1)).toEqual([{ turnId: 't1', n: 1, startUsd: 0, ended: false }])
})

test('pane engine: the ledger numbers turns and keeps the newest 200', () => {
  let ledger = startTurn([], 't0', 0)
  for (let i = 1; i <= MAX_TURNS + 5; i += 1) ledger = startTurn(ledger, `t${i}`, 0)
  expect(ledger).toHaveLength(MAX_TURNS)
  expect(ledger.at(-1)?.n).toBe(MAX_TURNS + 6)
  expect(ledger[0]?.n).toBe(7)
})

test('pane engine: a timed turn keeps its start, end and tool count; an untimed one adds no keys', () => {
  const started = startTurn([], 't1', 0, 1_000)
  expect(started).toEqual([{ turnId: 't1', n: 1, startUsd: 0, ended: false, startedAt: 1_000, tools: 0 }])
  const counted = countTool(countTool(started))
  expect(counted[0]?.tools).toBe(2)
  expect(started[0]?.tools).toBe(0)
  const ended = endTurn(counted, 't1', 0.5, 4_000)
  expect(ended).toEqual([{ turnId: 't1', n: 1, startUsd: 0, ended: true, usd: 0.5, startedAt: 1_000, endedAt: 4_000, tools: 2 }])
  // A call between turns belongs to none.
  expect(countTool(ended)).toEqual(ended)
  expect(countTool([])).toEqual([])
})

test('pane engine: the files ledger counts each action per file and moves the file to the newest end', () => {
  const one = touchFile([], '/repo/a.ts', 'reads', 1)
  const two = touchFile(one, '/repo/b.ts', 'writes', 2)
  const three = touchFile(two, '/repo/a.ts', 'edits', 3)
  expect(three).toEqual([
    { path: '/repo/b.ts', reads: 0, edits: 0, writes: 1, at: 2 },
    { path: '/repo/a.ts', reads: 1, edits: 1, writes: 0, at: 3 },
  ])
  expect(one).toEqual([{ path: '/repo/a.ts', reads: 1, edits: 0, writes: 0, at: 1 }])
  let ledger = one
  for (let i = 0; i < MAX_FILES + 3; i += 1) ledger = touchFile(ledger, `/repo/f${i}.ts`, 'reads', i)
  expect(ledger).toHaveLength(MAX_FILES)
  expect(ledger.at(-1)?.path).toBe(`/repo/f${MAX_FILES + 2}.ts`)
})
