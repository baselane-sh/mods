import { expect, test } from 'claude-code/testing'

import { waitBeforeLoad } from '../hooks/engine'
import { clean, durationText, redactLines } from '../hooks/lines'

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
