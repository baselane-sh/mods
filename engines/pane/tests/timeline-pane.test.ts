import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { SURFACES, probe } from './probe'

type Session = ReturnType<typeof probe>
type Engine = Parameters<TestBody>[0]

const RULE = '─'.repeat(72)
// A turn's row: its number, then its start time.
const ROW = /^\d+ +(\d\d:|\?)/
const HEAD = 'TURN  START     LENGTH       TOOLS  COST'

// A main-loop turn that makes `calls` Read calls and runs `ms` on the mocked
// clock, its cost moving to `usd`.
const turn = async (session: Session, $: Engine, id: string, calls: number, ms: number, usd?: number) => {
  await $.turn.start({ text: 'go', turnId: id })
  for (let i = 0; i < calls; i += 1) await session.call({ tool: 'Read', file_path: `/repo/f${i}.ts`, tool_use_id: `${id}-${i}` })
  await session.clock.advance(ms)
  if (usd !== undefined) session.setUsd(usd)
  await $.turn.complete({ answer: '', durationMs: ms, isAborted: false, turnId: id, reason: 'answer' })
  await session.clock.settle()
}

test('timeline-pane: /timeline is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on)
  await session.start()
  expect(session.commands()).toEqual(['timeline'])
  expect((await session.command('timeline')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'timeline', title: 'Timeline', closeOnEscape: true }])
  expect((await session.command('timeline')).text).toContain('closed')
  expect(session.closes()).toEqual(['timeline'])
})

test('timeline-pane: each turn with its start, length, tool count and cost, newest first, on every surface', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turn(session, $, 't1', 2, 4_000, 0.1)
  await session.clock.advance(2_000)
  await turn(session, $, 't2', 1, 1_500, 0.35)
  await session.clock.advance(2_000)
  await session.command('timeline')
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'timeline', 72)
    expect(await session.lines(ui)).toEqual([
      '2 turns this session, newest first',
      HEAD,
      '2     12:35:02  1.5 s        1      $0.25',
      '1     12:34:56  4.0 s        2      $0.10',
      RULE,
      'Total  5.5 s  3 tools  $0.35',
    ])
    await ui.unmount()
  }
})

test('timeline-pane: the running turn shows as running and counts its tools live', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turn(session, $, 't1', 1, 3_000, 0.2)
  await session.clock.advance(2_000)
  await session.command('timeline')
  await $.turn.start({ text: 'go', turnId: 't2' })
  await session.clock.advance(2_000)
  await session.call({ tool: 'Bash', command: 'ls', tool_use_id: 'b1' })
  await session.clock.advance(2_000)
  await session.call({ tool: 'Bash', command: 'pwd', tool_use_id: 'b2' })
  const ui = await session.mount('terminal', 'timeline', 72)
  const lines = await session.lines(ui)
  expect(lines[2]).toBe('2     12:35:01  running      2      ?')
  expect(lines.at(-1)).toBe('Total  3.0 s  3 tools  $0.20')
  await ui.unmount()
})

test('timeline-pane: a subagent turn end does not end the turn, and calls made meanwhile count in it', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await $.turn.start({ text: 'go', turnId: 'main' })
  // A subagent's call: the probe's input carries no agentId, as the kit's type has none.
  await session.call({ tool: 'Read', file_path: '/repo/a.ts' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 'main', reason: 'answer', agentId: 'agent-1' })
  await session.clock.advance(1_000)
  await turn(session, $, 'main', 1, 1_000, 0.4)
  await session.clock.advance(2_000)
  await session.command('timeline')
  const ui = await session.mount('terminal', 'timeline', 72)
  const rows = (await session.lines(ui)).filter(text => ROW.test(text))
  expect(rows).toEqual(['1     12:34:56  2.0 s        2      $0.40'])
  await ui.unmount()
})

test('timeline-pane: before any turn the pane says so', async ($, on) => {
  const session = probe($, on)
  await session.command('timeline')
  const ui = await session.mount('terminal', 'timeline', 72)
  expect(await session.lines(ui)).toEqual(['No turn yet. Each turn shows here as it runs.'])
  await ui.unmount()
})

test('timeline-pane: a host with no cost ledger shows ? for cost, never $0.00', async ($, on) => {
  const session = probe($, on)
  await turn(session, $, 't1', 0, 500)
  await session.clock.advance(2_000)
  await session.command('timeline')
  const ui = await session.mount('terminal', 'timeline', 72)
  const lines = await session.lines(ui)
  expect(lines[2]).toBe('1     12:34:56  500 ms       0      ?')
  expect(lines.at(-1)).toBe('Total  500 ms  0 tools  ?')
  await ui.unmount()
})

test('timeline-pane: only the last 20 turns are drawn; the total counts every turn', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  for (let n = 1; n <= 22; n += 1) {
    await turn(session, $, `t${n}`, 1, 1_000, n * 0.01)
    await session.clock.advance(1_000)
  }
  await session.command('timeline')
  const ui = await session.mount('terminal', 'timeline', 72)
  const lines = await session.lines(ui)
  expect(lines[0]).toBe('22 turns this session, last 20 shown, newest first')
  const rows = lines.filter(text => ROW.test(text))
  expect(rows).toHaveLength(20)
  expect(rows[0]).toMatch(/^22 /)
  expect(rows[19]).toMatch(/^3 /)
  expect(lines.at(-1)).toBe('Total  22.0 s  22 tools  $0.22')
  await ui.unmount()
})

test('timeline-pane: lines fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turn(session, $, 't1', 3, 65_000, 1.25)
  await session.command('timeline')
  for (const surface of SURFACES) {
    for (const columns of [40, 20, 8]) {
      const ui = await session.mount(surface, 'timeline', columns)
      for (const text of await session.lines(ui)) {
        expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('timeline-pane: runs no command', async ($, on) => {
  const session = probe($, on)
  await session.command('timeline')
  await turn(session, $, 't1', 1, 1_000)
  expect(session.runs()).toEqual([])
})
