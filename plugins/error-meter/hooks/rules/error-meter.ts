import type { BandRule } from '../rule'

// Failed tool calls this session (an error result or a deny) and the tool that
// failed last. Red from the first failure; the words say the same without it.
export const rule: BandRule = {
  id: 'error-meter',
  tracksTools: true,
  segment: ({ tally }) => {
    if (Object.keys(tally.calls).length === 0) return undefined
    if (tally.failures === 0) return { key: 'error-meter', text: '0 failed' }
    const last = tally.lastFailed === undefined ? '' : ` · last ${tally.lastFailed}`
    return { key: 'error-meter', text: `${tally.failures} failed${last}`, color: 'red' }
  },
}
