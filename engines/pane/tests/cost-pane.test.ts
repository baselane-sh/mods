import { expect, test } from 'claude-code/testing'

import { money } from '../hooks/rules/cost-pane'
import { SURFACES, probe } from './probe'

const RULE = '─'.repeat(72)
const bar = (n: number): string => '█'.repeat(n).padEnd(20)

// Turns end at these session costs, each two seconds after the last, so the
// pane's once-a-second limit never holds a refresh back.
const turns = async (session: ReturnType<typeof probe>, costs: readonly number[]) => {
  for (const usd of costs) {
    await session.turn(usd)
    await session.clock.advance(2_000)
  }
}

test('cost-pane money: cents, and less than a cent said so', () => {
  expect(money(1.2)).toBe('$1.20')
  expect(money(0.004)).toBe('<$0.01')
  expect(money(0)).toBe('$0.00')
})

test('cost-pane: /cost-pane is registered and toggles a pane that Esc closes', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await session.start()
  expect(session.commands()).toEqual(['cost-pane'])
  expect((await session.command('cost-pane')).text).toContain('opened')
  expect(session.opens()).toEqual([{ id: 'cost', title: 'Cost', closeOnEscape: true }])
  expect((await session.command('cost-pane')).text).toContain('closed')
  expect(session.closes()).toEqual(['cost'])
})

test('cost-pane: session cost, each turn as a bar and the average at 72 columns on every surface', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0.5)
  await session.command('cost-pane')
  await session.clock.advance(2_000)
  await turns(session, [0.9, 1.0, 1.2])
  for (const surface of SURFACES) {
    const ui = await session.mount(surface, 'cost', 72)
    expect((await ui.find({ key: 'header' }))?.text).toMatch(/^Cost  updated \d\d:\d\d:\d\d$/)
    expect(await session.lines(ui)).toEqual([
      'Session cost  $1.20',
      RULE,
      'Last 3 turns, newest first',
      `turn 3  ${bar(10)}  $0.20`,
      `turn 2  ${bar(5)}  $0.10`,
      `turn 1  ${bar(20)}  $0.40`,
      RULE,
      'Average per turn  $0.23  over 3 turns',
    ])
    await ui.unmount()
  }
})

test('cost-pane: only the last 10 turns are drawn; the average counts every measured turn', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  // Twelve turns: the first two cost $1.00 each, the rest $0.10 each.
  await turns(session, [1, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3])
  await session.command('cost-pane')
  const ui = await session.mount('terminal', 'cost')
  const lines = await session.lines(ui)
  expect(lines[2]).toBe('Last 10 turns, newest first')
  const rows = lines.filter(text => text.startsWith('turn '))
  expect(rows).toHaveLength(10)
  expect(rows[0]).toMatch(/^turn 12 /)
  expect(rows[9]).toMatch(/^turn 3  /)
  expect(lines.at(-1)).toBe('Average per turn  $0.25  over 12 turns')
  await ui.unmount()
})

test('cost-pane: turns are measured while the pane is closed', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turns(session, [0.3])
  expect(session.runs()).toEqual([])
  await session.command('cost-pane')
  const ui = await session.mount('terminal', 'cost')
  expect(await session.lines(ui)).toContain(`turn 1  ${bar(20)}  $0.30`)
  await ui.unmount()
})

test('cost-pane: a subagent turn is not a turn of its own, nor the end of the turn it ran in', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await session.command('cost-pane')
  await session.clock.advance(2_000)
  const end = (extra: { agentId?: string }) =>
    $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 'main', reason: 'answer', ...extra })
  await $.turn.start({ text: 'go', turnId: 'main' })
  session.setUsd(0.3)
  await end({ agentId: 'agent-1' })
  session.setUsd(0.5)
  await end({})
  await session.clock.advance(2_000)
  await session.turn(0.6, { agentId: 'agent-2' })
  await session.clock.advance(2_000)
  const ui = await session.mount('terminal', 'cost')
  const lines = await session.lines(ui)
  expect(lines.filter(text => text.startsWith('turn '))).toEqual([`turn 1  ${bar(20)}  $0.50`])
  expect(lines[0]).toBe('Session cost  $0.60')
  await ui.unmount()
})

test('cost-pane: a turn end redraws the open pane without reopening it', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await session.command('cost-pane')
  const before = await session.mount('terminal', 'cost')
  expect(await session.lines(before)).toContain('No finished turn yet. Each turn shows here when it ends.')
  await before.unmount()
  await session.clock.advance(2_000)
  await turns(session, [0.25])
  const after = await session.mount('terminal', 'cost')
  expect(await session.lines(after)).toContain(`turn 1  ${bar(20)}  $0.25`)
  await after.unmount()
})

test('cost-pane: the session cost refreshes every 5 seconds while open, mid-turn too', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0.1)
  await session.command('cost-pane')
  session.setUsd(0.75)
  await session.clock.advance(5_000)
  const ui = await session.mount('terminal', 'cost')
  expect((await session.lines(ui))[0]).toBe('Session cost  $0.75')
  await ui.unmount()
})

test('cost-pane: a host with no cost ledger says so', async ($, on) => {
  const session = probe($, on)
  await session.command('cost-pane')
  await session.clock.advance(2_000)
  await turns(session, [])
  const ui = await session.mount('terminal', 'cost', 120)
  expect(await session.lines(ui)).toEqual(['This host keeps no cost ledger, so there is no cost to show.'])
  await ui.unmount()
})

test('cost-pane: a cost that falls (a cleared session) leaves that turn unmeasured, never negative', async ($, on) => {
  const session = probe($, on)
  session.setUsd(2)
  await turns(session, [2.5, 0.1, 0.4])
  await session.command('cost-pane')
  const ui = await session.mount('terminal', 'cost')
  const rows = (await session.lines(ui)).filter(text => text.startsWith('turn '))
  expect(rows).toEqual([`turn 3  ${bar(12)}  $0.30`, `turn 1  ${bar(20)}  $0.50`])
  await ui.unmount()
})

test('cost-pane: a turn under a cent still draws one block and says less than a cent', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turns(session, [1, 1.002])
  await session.command('cost-pane')
  const ui = await session.mount('terminal', 'cost')
  expect(await session.lines(ui)).toContain(`turn 2  ${bar(1)}  <$0.01`)
  await ui.unmount()
})

test('cost-pane: one turn reads in the singular', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turns(session, [0.3])
  await session.command('cost-pane')
  const ui = await session.mount('terminal', 'cost')
  const lines = await session.lines(ui)
  expect(lines[2]).toBe('Last turn')
  expect(lines.at(-1)).toBe('Average per turn  $0.30  over 1 turn')
  await ui.unmount()
})

test('cost-pane: lines fit narrow panes on every surface', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await turns(session, [0.4, 0.5, 1.5])
  await session.command('cost-pane')
  for (const surface of SURFACES) {
    for (const columns of [40, 20, 8]) {
      const ui = await session.mount(surface, 'cost', columns)
      for (const text of await session.lines(ui)) {
        expect({ surface, columns, text, fits: text.length <= columns }).toEqual({ surface, columns, text, fits: true })
      }
      await ui.unmount()
    }
  }
})

test('cost-pane: runs no command', async ($, on) => {
  const session = probe($, on)
  session.setUsd(0)
  await session.command('cost-pane')
  await turns(session, [0.1])
  await session.call({ tool: 'Write', file_path: '/repo/a.ts', content: 'x' })
  expect(session.runs()).toEqual([])
})
