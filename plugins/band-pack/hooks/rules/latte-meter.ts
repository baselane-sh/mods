import type { BandRule } from '../rule'

export const DEFAULT_LATTE_PRICE = 5

// The session cost in coffees. The price is in the cost's currency (US
// dollars); one that cannot divide falls back to the default.
export const rule: BandRule = {
  id: 'latte-meter',
  segment: ({ reading, options }) => {
    if (reading.usd === undefined) return undefined
    const set = options['lattePrice']
    const price = typeof set === 'number' && Number.isFinite(set) && set > 0 ? set : DEFAULT_LATTE_PRICE
    const count = (reading.usd / price).toFixed(1)
    return { key: 'latte-meter', text: `${count} ${count === '1.0' ? 'latte' : 'lattes'}` }
  },
}
