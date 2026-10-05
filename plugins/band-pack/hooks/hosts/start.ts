import type { On } from 'claude-code'

import { tickersOf } from '../engine'
import type { BandRule } from '../rule'

// The slash commands of the timer rules. `on("session.start")` takes one hook,
// so a pack of timer and fetching rules needs a host that does both.
export const startSession = (on: On, rules: readonly BandRule[]): void => {
  const tickers = tickersOf(rules)
  on('session.start', async ($, e, next) => {
    for (const { command } of tickers) await $.command.register(command)
    return next(e)
  })
}
