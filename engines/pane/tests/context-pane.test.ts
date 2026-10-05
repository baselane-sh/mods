import { expect, test } from 'claude-code/testing'

import { contextBar, thousands } from '../hooks/rules/context-pane'
import { SURFACES, probe } from './probe'

const TIP = 'Tip: run /compact to summarize and free room, or /clear to start fresh.'

test('context-pane: thousands are grouped and the bar fills by percent', () => {
  expect(thousands(0)).toBe('0')
  expect(thousands(999)).toBe('999')
  expect(thousands(112_000)).toBe('112,000')
  expect(thousands(1_000_000)).toBe('1,000,000')
  expect(contextBar(0)).toBe('░'.repeat(30))
  expect(contextBar(50)).toBe(`${'█'.repeat(15)}${'░'.repeat(15)}`)
  expect(contextBar(100)).toBe('█'.repeat(30))
  expect(contextBar(140)).toBe('█'.repeat(30))
  // Anything above zero draws at least one cell.
  expect(contextBar(1)).toBe(`█${'░'.repeat(29)}`)
})

test('context-pane: /context-pane is registered (not /context) and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.commands()).toEqual(['context-pane'])
  expect((await session.command('context-pane')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'context', title: 'Context', closeOnEscape: true }])
  expect((await session.command('context-pane')).text).toContain('closed')
  expect(session.closes()).toEqual(['context'])
})

test('context-pane: percent, bar and tokens, with no tip at 56 percent, on every surface', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 112_000, percent: 56 })
  await session.command('context-pane')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'context', 72)
    expect(await session.lines(ui)).toEqual(['56% of the context window used', contextBar(56), '112,000 of 200,000 tokens'])
    const percent = await ui.find({ type: 'Text', text: '56% of the context window used' })
    expect(percent?.props.color).toBe('yellow')
    await ui.unmount()
  }
})

test('context-pane: over 75 percent it is red and adds a short tip', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 164_000, percent: 82 })
  await session.command('context-pane')
  const ui = await session.mount('terminal', 'context', 80)
  expect(await session.lines(ui)).toEqual(['82% of the context window used', contextBar(82), '164,000 of 200,000 tokens', '─'.repeat(80), TIP])
  expect((await ui.find({ type: 'Text', text: '82% of the context window used' }))?.props.color).toBe('red')
  await ui.unmount()
})

test('context-pane: exactly 75 percent gives no tip; a low reading is green', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 150_000, percent: 75 })
  await session.command('context-pane')
  const at75 = await session.mount('terminal', 'context', 80)
  expect(await session.lines(at75)).not.toContain(TIP)
  await at75.unmount()
  session.setContext({ window: 200_000, tokens: 20_000, percent: 10 })
  await session.clock.advance(5_000)
  const low = await session.mount('terminal', 'context', 80)
  expect((await low.find({ type: 'Text', text: '10% of the context window used' }))?.props.color).toBe('green')
  await low.unmount()
})

test('context-pane: a reading with tokens but no percent works the percent out', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 1_000_000, tokens: 800_000 })
  await session.command('context-pane')
  const ui = await session.mount('terminal', 'context', 80)
  const lines = await session.lines(ui)
  expect(lines[0]).toBe('80% of the context window used')
  expect(lines[2]).toBe('800,000 of 1,000,000 tokens')
  expect(lines.at(-1)).toBe(TIP)
  await ui.unmount()
})

test('context-pane: before the first reply there is no reading, and the pane says so', async ($, on) => {
  const session = probe($, on)
  await session.command('context-pane')
  const ui = await session.mount('terminal', 'context', 80)
  expect(await session.lines(ui)).toEqual(['No context reading yet. It shows after the first reply.', 'Window: 200,000 tokens'])
  await ui.unmount()
})

test('context-pane: refreshes every 5 seconds while open', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 20_000, percent: 10 })
  await session.command('context-pane')
  session.setContext({ window: 200_000, tokens: 40_000, percent: 20 })
  await session.clock.advance(5_000)
  const ui = await session.mount('terminal', 'context', 72)
  expect((await session.lines(ui))[0]).toBe('20% of the context window used')
  await ui.unmount()
})

test('context-pane: lines fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 190_000, percent: 95 })
  await session.command('context-pane')
  for (const surface of SURFACES) {
    for (const columns of [40, 20, 8]) {
      const ui = await session.mount(surface, 'context', columns)
      for (const text of await session.lines(ui)) {
        expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('context-pane: runs no command', async ($, on) => {
  const session = probe($, on)
  session.setContext({ window: 200_000, tokens: 1_000, percent: 1 })
  await session.command('context-pane')
  await session.bash('ls')
  expect(session.runs()).toEqual([])
})
