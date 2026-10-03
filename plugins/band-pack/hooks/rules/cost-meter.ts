import { dollars } from '../money'
import type { BandRule } from '../rule'

// The session cost so far, and the last turn's cost once it is known.
export const rule: BandRule = {
  id: 'cost-meter',
  segment: ({ reading }) => {
    if (reading.usd === undefined) return undefined
    const turn = reading.turnUsd === undefined ? '' : ` +${dollars(reading.turnUsd)}`
    return { key: 'cost-meter', text: `${dollars(reading.usd)}${turn}` }
  },
}
