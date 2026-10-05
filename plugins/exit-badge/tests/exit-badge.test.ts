import { expect, test } from 'claude-code/testing'

import { exitCodeOf } from '../hooks/output'
import { bashOutput, ENGINE_KEY, mountToolUse, rootProps, standIn, SURFACES, toolUse } from './probe'

const KEY = 'exit-badge'
const LS = { command: 'ls missing' }

test('exit-badge: exitCodeOf reads the code a failed command reports', () => {
  expect(exitCodeOf('Exit code 1\nls: missing: No such file')).toBe(1)
  expect(exitCodeOf('Error: Exit code 127\nzsh: command not found: nope')).toBe(127)
  expect(exitCodeOf([{ type: 'text', text: 'Exit code 2' }])).toBe(2)
  expect(exitCodeOf('The user refused the call.')).toBeUndefined()
  expect(exitCodeOf('Exit code one')).toBeUndefined()
  expect(exitCodeOf(bashOutput('Exit code 1'))).toBe(1)
  expect(exitCodeOf(42)).toBeUndefined()
})

test('exit-badge: a failed Bash row draws a red exit badge beside the engine row', async ($, on) => {
  standIn(on)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Bash', LS, { isErrored: true, output: 'Error: Exit code 2\nls: missing: No such file' }))
    expect({ surface, text: (await ui.find({ key: KEY }))?.text }).toEqual({ surface, text: 'exit 2' })
    expect((await ui.find({ type: 'Text', text: 'exit 2' }))?.props.color).toBe('red')
    expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
    expect(rootProps(await ui.drawn()).flexDirection).toBe('row')
    await ui.unmount()
  }
})

test('exit-badge: success, a refusal, an abort, a running call and other tools keep the engine row alone', async ($, on) => {
  standIn(on)
  const cases = [
    toolUse('Bash', { command: 'ls' }, { output: bashOutput('a.ts') }),
    toolUse('Bash', LS, { isErrored: true, output: 'The user refused the call.' }),
    toolUse('Bash', LS, { isErrored: true, isInterrupted: true, output: 'Exit code 130' }),
    toolUse('Bash', LS, { isRunning: true }),
    toolUse('Bash', LS, { isErrored: true, output: 'Exit code 0' }),
    toolUse('Grep', { pattern: 'x' }, { isErrored: true, output: 'Exit code 1' }),
  ]
  for (const surface of SURFACES) {
    for (const [index, props] of cases.entries()) {
      const ui = await mountToolUse($, surface, props)
      const drawn = await ui.drawn()
      expect({ surface, index, key: rootProps(drawn).key }).toEqual({ surface, index, key: ENGINE_KEY })
      await ui.unmount()
    }
  }
})
