import type { BandRule } from '../rule'

const SHOWN = 3

// Tool calls this session, the three most used. The sort is stable, so a tie
// keeps the tool seen first ahead. A failed or denied call counts too.
export const rule: BandRule = {
  id: 'tool-counter',
  tracksTools: true,
  segment: ({ tally }) => {
    const top = Object.entries(tally.calls)
      .sort(([, a], [, b]) => b - a)
      .slice(0, SHOWN)
    return top.length === 0 ? undefined : { key: 'tool-counter', text: top.map(([tool, n]) => `${tool} ${n}`).join(' · ') }
  },
}
