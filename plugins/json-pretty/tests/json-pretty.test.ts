import { expect, test } from 'claude-code/testing'

import { FOLD_AT, MIN_JSON, prettyJson } from '../hooks/output'
import { create } from '../hooks/rules/json-pretty'
import { bashOutput, ENGINE_KEY, mountToolResult, rootProps, standIn, SURFACES, toolResult } from './probe'

const RECORD = { id: 42, name: 'baselane-mods', tags: ['render', 'json'], owner: { login: 'mohammad', site: 'baselane' } }
const LINE = JSON.stringify(RECORD)
const PRETTY = JSON.stringify(RECORD, null, 2)
const BIG = JSON.stringify(Array.from({ length: 40 }, (_, i) => i))

test('json-pretty: prettyJson pretty-prints one long line of JSON and folds after 30 lines', () => {
  expect(LINE.length).toBeGreaterThanOrEqual(MIN_JSON)
  expect(prettyJson(`${LINE}\n`)).toBe(PRETTY)
  const folded = prettyJson(BIG)?.split('\n') ?? []
  expect(FOLD_AT).toBe(30)
  expect(folded.length).toBe(31)
  expect(folded[29]).toBe('  28,')
  expect(folded[30]).toBe('... 12 more lines')
})

test('json-pretty: short, multi-line, scalar and broken JSON are left as written', () => {
  expect(prettyJson('{"a":1}')).toBeUndefined()
  expect(prettyJson(`${LINE}\n${LINE}`)).toBeUndefined()
  expect(prettyJson(`"${'x'.repeat(100)}"`)).toBeUndefined()
  expect(prettyJson(`{${'x'.repeat(100)}`)).toBeUndefined()
  expect(prettyJson(`total ${'x'.repeat(100)}`)).toBeUndefined()
})

test('json-pretty: the rewrite changes stdout alone and leaves the stored props as they were', () => {
  const rewrite = create().toolResult?.rewrite
  const props = toolResult('Bash', { ...bashOutput(LINE, 'warn'), interrupted: false, noOutputExpected: false })
  const rewritten = rewrite?.(props)
  expect(rewritten).toEqual({ ...props, output: { ...bashOutput(PRETTY, 'warn'), noOutputExpected: false } })
  expect(props.output).toEqual({ ...bashOutput(LINE, 'warn'), noOutputExpected: false })
})

test('json-pretty: a Bash result of one long JSON line is drawn pretty by the engine', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolResult($, surface, toolResult('Bash', bashOutput(LINE)))
    const drawn = await ui.drawn()
    expect({ surface, key: rootProps(drawn).key }).toEqual({ surface, key: ENGINE_KEY })
    expect((await ui.find({ key: ENGINE_KEY }))?.text).toBe(PRETTY)
    await ui.unmount()
  }
})

test('json-pretty: other tools, errors, plain text and odd output are drawn as stored', async ($, on) => {
  standIn(on)
  const cases = [
    toolResult('Grep', LINE),
    toolResult('Bash', bashOutput(LINE), { isErrored: true }),
    toolResult('Bash', bashOutput('a.ts\nb.ts')),
    toolResult('Bash', 'not a record'),
    toolResult('Bash', { stdout: 42 }),
  ]
  for (const surface of SURFACES) {
    for (const [index, props] of cases.entries()) {
      const ui = await mountToolResult($, surface, props)
      const shown = (await ui.find({ key: ENGINE_KEY }))?.text
      expect({ surface, index, isPretty: shown === PRETTY }).toEqual({ surface, index, isPretty: false })
      await ui.unmount()
    }
  }
})
