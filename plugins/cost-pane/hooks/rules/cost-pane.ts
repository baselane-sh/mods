import type { PaneLine, TurnCost } from '../../types'
import { line, ruleLine } from '../lines'
import type { PaneRule } from '../rule'

// The session cost, the cost of each of the last turns as a bar, and the
// average per turn. The engine measures each turn (`turns: true`); this rule
// only draws what it measured.
const SHOWN = 10
const BAR = 20

type Measured = TurnCost & { usd: number }

export const money = (usd: number): string => (usd > 0 && usd < 0.005 ? '<$0.01' : `$${usd.toFixed(2)}`)

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// A turn that cost anything draws at least one block.
const blocks = (usd: number, most: number): number => (most <= 0 || usd <= 0 ? 0 : Math.max(1, Math.round((usd / most) * BAR)))

const turnLines = (measured: readonly Measured[]): PaneLine[] => {
  const shown = measured.slice(-SHOWN).reverse()
  const most = Math.max(...shown.map(turn => turn.usd))
  const width = Math.max(...shown.map(turn => `turn ${turn.n}`.length))
  const average = measured.reduce((sum, turn) => sum + turn.usd, 0) / measured.length
  return [
    line('turns', { text: shown.length === 1 ? 'Last turn' : `Last ${shown.length} turns, newest first`, bold: true }),
    ...shown.map(turn =>
      line(
        `turn-${turn.n}`,
        { text: `turn ${turn.n}`.padEnd(width), dim: true },
        { text: `  ${'█'.repeat(blocks(turn.usd, most)).padEnd(BAR)}`, color: 'yellow' },
        { text: `  ${money(turn.usd)}` },
      ),
    ),
    ruleLine('rule-average'),
    line(
      'average',
      { text: 'Average per turn', bold: true },
      { text: `  ${money(average)}` },
      { text: `  over ${plural(measured.length, 'turn')}`, dim: true },
    ),
  ]
}

export const rule: PaneRule = {
  id: 'cost-pane',
  pane: {
    id: 'cost',
    title: 'Cost',
    command: 'cost-pane',
    description: 'Show or hide the Cost pane: session cost, the last 10 turns as bars, the average per turn',
    empty: 'Reading the session cost…',
  },
  // The session cost moves mid-turn too.
  everyMs: 5_000,
  turns: true,
  load: async host => {
    const cost = (await host.usage()).cost
    if (cost === undefined) return [line('no-ledger', { text: 'This host keeps no cost ledger, so there is no cost to show.', dim: true })]
    const measured = (await host.turns()).filter((turn): turn is Measured => turn.usd !== undefined)
    return [
      line('session', { text: 'Session cost', bold: true }, { text: `  ${money(cost.usd)}`, color: 'cyan', bold: true }),
      ruleLine('rule-turns'),
      ...(measured.length === 0
        ? [line('no-turns', { text: 'No finished turn yet. Each turn shows here when it ends.', dim: true })]
        : turnLines(measured)),
    ]
  },
}
