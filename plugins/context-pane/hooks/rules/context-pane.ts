import type { SessionContextUsage } from 'claude-code'

import type { PaneLine } from '../../types'
import { line, ruleLine } from '../lines'
import type { PaneRule } from '../rule'

// How full the context window is: the percent, a bar, the tokens used, and a
// short tip once it is over 75 percent. Read from `$.session.usage()`, the
// status line's free figures; no command runs and nothing is counted anew.
const BAR = 30
const TIP_ABOVE = 75
const WARN_FROM = 50

export const thousands = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Anything above zero draws at least one cell; past 100 it is full.
export const contextBar = (percent: number): string => {
  const filled = percent <= 0 ? 0 : Math.min(BAR, Math.max(1, Math.round((percent / 100) * BAR)))
  return `${'█'.repeat(filled)}${'░'.repeat(BAR - filled)}`
}

const colorOf = (percent: number): string => (percent > TIP_ABOVE ? 'red' : percent >= WARN_FROM ? 'yellow' : 'green')

const percentOf = (context: SessionContextUsage): number | undefined => {
  if (context.percent !== undefined) return context.percent
  if (context.tokens === undefined || context.window <= 0) return undefined
  return Math.round((context.tokens / context.window) * 100)
}

export const contextLines = (context: SessionContextUsage): PaneLine[] => {
  const percent = percentOf(context)
  if (percent === undefined) {
    return [
      line('none', { text: 'No context reading yet. It shows after the first reply.', dim: true }),
      line('window', { text: `Window: ${thousands(context.window)} tokens`, dim: true }),
    ]
  }
  const color = colorOf(percent)
  return [
    line('percent', { text: `${percent}% of the context window used`, bold: true, color }),
    line('bar', { text: contextBar(percent), color }),
    line(
      'tokens',
      context.tokens === undefined
        ? { text: `${thousands(context.window)} token window`, dim: true }
        : { text: `${thousands(context.tokens)} of ${thousands(context.window)} tokens`, dim: true },
    ),
    ...(percent > TIP_ABOVE
      ? [ruleLine('rule-tip'), line('tip', { text: 'Tip: run /compact to summarize and free room, or /clear to start fresh.', color: 'yellow' })]
      : []),
  ]
}

export const rule: PaneRule = {
  id: 'context-pane',
  pane: {
    id: 'context',
    title: 'Context',
    // Not `context`: that is Claude Code's own command.
    command: 'context-pane',
    description: 'Show or hide the Context pane: how full the context window is, as a bar with the tokens used',
    empty: 'Reading the context window…',
  },
  // The window fills with each reply, mid-turn too.
  everyMs: 5_000,
  refreshAfter: () => true,
  load: async host => contextLines((await host.usage()).context),
}
