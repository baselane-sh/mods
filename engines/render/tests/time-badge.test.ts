import { expect, test } from 'claude-code/testing'

import { formatDuration } from '../hooks/badge'
import { ENGINE_KEY, mountToolUse, ran, rootProps, standIn, SURFACES, toolUse } from './probe'

const KEY = 'time-badge'
const DONE = { output: { stdout: 'ok', stderr: '', interrupted: false } }

test('time-badge: formatDuration writes tenths under a minute, minutes and seconds above', () => {
  expect(formatDuration(1001)).toBe('1.0s')
  expect(formatDuration(2400)).toBe('2.4s')
  expect(formatDuration(12_340)).toBe('12.3s')
  expect(formatDuration(59_960)).toBe('1m 0s')
  expect(formatDuration(65_000)).toBe('1m 5s')
  expect(formatDuration(3_600_000)).toBe('60m 0s')
})

test('time-badge: a call that ran 2.4 seconds draws a dim 2.4s beside the engine row', async ($, on) => {
  standIn(on)
  await ran($, 'toolu_01', 2400)
  for (const surface of SURFACES) {
    const ui = await mountToolUse($, surface, toolUse('Bash', { command: 'sleep 2' }, DONE))
    const badge = await ui.find({ key: KEY })
    expect({ surface, text: badge?.text }).toEqual({ surface, text: '2.4s' })
    expect((await ui.find({ type: 'Text', text: '2.4s' }))?.props.dimColor).toBe(true)
    expect(await ui.find({ key: ENGINE_KEY })).toBeDefined()
    expect(rootProps(await ui.drawn()).flexDirection).toBe('row')
    await ui.unmount()
  }
})

test('time-badge: a failed call shows its time too, and a long one in minutes', async ($, on) => {
  standIn(on)
  await ran($, 'toolu_fail', 3100, true)
  await ran($, 'toolu_long', 65_000)
  const failed = await mountToolUse($, 'terminal', toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_fail', isErrored: true, output: 'boom' }))
  expect((await failed.find({ key: KEY }))?.text).toBe('3.1s')
  await failed.unmount()
  const long = await mountToolUse($, 'desktop', toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_long', ...DONE }))
  expect((await long.find({ key: KEY }))?.text).toBe('1m 5s')
  await long.unmount()
})

test('time-badge: one second or less, no duration, or no record keeps the engine row alone', async ($, on) => {
  standIn(on)
  await ran($, 'toolu_fast', 1000)
  await ran($, 'toolu_none', undefined)
  const cases = [
    toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_fast', ...DONE }),
    toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_none', ...DONE }),
    toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_unknown', ...DONE }),
  ]
  for (const surface of SURFACES) {
    for (const props of cases) {
      const ui = await mountToolUse($, surface, props)
      const drawn = await ui.drawn()
      expect({ surface, id: props.tool_use_id, key: rootProps(drawn).key }).toEqual({ surface, id: props.tool_use_id, key: ENGINE_KEY })
      await ui.unmount()
    }
  }
})

test('time-badge: a row drawn while running gains the badge once the call reports its time', async ($, on) => {
  standIn(on)
  const ui = await mountToolUse($, 'terminal', toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_live', isRunning: true }))
  expect(await ui.find({ key: KEY })).toBeUndefined()
  await ran($, 'toolu_live', 4500)
  await ui.redraw(toolUse('Grep', { pattern: 'x' }, { tool_use_id: 'toolu_live', ...DONE }))
  expect((await ui.find({ key: KEY }))?.text).toBe('4.5s')
  await ui.unmount()
})
