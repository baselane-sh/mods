import type { PaneLine, TurnCost } from '../../types'
import { durationText, line, ruleLine, timeOfDay } from '../lines'
import type { PaneRule } from '../rule'

// The turns of this session, newest first: when each began, how long it ran,
// how many tool calls it made and what it cost. The engine keeps the ledger
// (`turns: true`); this rule only draws it.
const SHOWN = 20
const TURN_WIDTH = 6
const START_WIDTH = 10
const LENGTH_WIDTH = 13
const TOOLS_WIDTH = 7

const money = (usd: number): string => (usd > 0 && usd < 0.005 ? '<$0.01' : `$${usd.toFixed(2)}`)

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const lengthOf = (turn: TurnCost): number | undefined =>
  turn.startedAt === undefined || turn.endedAt === undefined ? undefined : Math.max(0, turn.endedAt - turn.startedAt)

const lengthText = (turn: TurnCost): string => {
  if (!turn.ended) return 'running'
  const ms = lengthOf(turn)
  return ms === undefined ? '?' : durationText(ms)
}

const headText = (count: number): string =>
  count > SHOWN ? `${count} turns this session, last ${SHOWN} shown, newest first` : `${plural(count, 'turn')} this session, newest first`

const turnLine = (turn: TurnCost): PaneLine =>
  line(
    `turn-${turn.n}`,
    { text: String(turn.n).padEnd(TURN_WIDTH), bold: true },
    { text: (turn.startedAt === undefined ? '?' : timeOfDay(turn.startedAt)).padEnd(START_WIDTH), dim: true },
    { text: lengthText(turn).padEnd(LENGTH_WIDTH), ...(turn.ended ? {} : { color: 'cyan' }) },
    { text: String(turn.tools ?? '?').padEnd(TOOLS_WIDTH) },
    { text: turn.usd === undefined ? '?' : money(turn.usd), ...(turn.usd === undefined ? { dim: true } : { color: 'yellow' }) },
  )

const totalLine = (ledger: readonly TurnCost[]): PaneLine => {
  const ms = ledger.reduce((sum, turn) => sum + (lengthOf(turn) ?? 0), 0)
  const tools = ledger.reduce((sum, turn) => sum + (turn.tools ?? 0), 0)
  const costs = ledger.flatMap(turn => (turn.usd === undefined ? [] : [turn.usd]))
  const usd = costs.length === 0 ? '?' : money(costs.reduce((sum, value) => sum + value, 0))
  return line('total', { text: 'Total', bold: true }, { text: `  ${durationText(ms)}` }, { text: `  ${plural(tools, 'tool')}` }, { text: `  ${usd}` })
}

export const timelineLines = (ledger: readonly TurnCost[]): PaneLine[] => {
  if (ledger.length === 0) return [line('none', { text: 'No turn yet. Each turn shows here as it runs.', dim: true })]
  return [
    line('count', { text: headText(ledger.length), bold: true }),
    line(
      'head',
      { text: 'TURN'.padEnd(TURN_WIDTH), dim: true },
      { text: 'START'.padEnd(START_WIDTH), dim: true },
      { text: 'LENGTH'.padEnd(LENGTH_WIDTH), dim: true },
      { text: 'TOOLS'.padEnd(TOOLS_WIDTH), dim: true },
      { text: 'COST', dim: true },
    ),
    ...ledger.slice(-SHOWN).reverse().map(turnLine),
    ruleLine('rule-total'),
    totalLine(ledger),
  ]
}

export const rule: PaneRule = {
  id: 'timeline-pane',
  pane: {
    id: 'timeline',
    title: 'Timeline',
    command: 'timeline',
    description: 'Show or hide the Timeline pane: each turn of this session with its start, length, tool count and cost',
    empty: 'Reading the turns of this session…',
  },
  turns: true,
  // A running turn's tool count moves with each call.
  refreshAfter: () => true,
  load: async host => timelineLines(await host.turns()),
}
