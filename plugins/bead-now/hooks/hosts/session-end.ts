import type { On } from 'claude-code'

import { stopMinuteTick } from '../minute'
import type { BandRule } from '../rule'
import { stopTurnTimer } from '../turn'

// For the rules that tick (each minute, or each second of a turn): the tick
// stops with the session. A /clear or a resume goes on in this process with
// the band still drawn, so the tick goes on too.
export const stopTicks = (on: On, _rules: readonly BandRule[]): void => {
  on('session.end', async (_$, e, next) => {
    if (e.reason !== 'clear' && e.reason !== 'resume') stopMinuteTick()
    stopTurnTimer()
    return next(e)
  })
}
