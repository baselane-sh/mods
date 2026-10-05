import type { On } from 'claude-code'

import type { Nudge, PendingNotes } from '../engine'

// The next prompt carries the reminders kept at the turn's end, once. No `$` call.
export const notePrompts = (on: On, _nudges: readonly Nudge[], notes: PendingNotes): void => {
  on('prompt.submit', (_$, e, next) => {
    const taken = notes.take()
    return next(taken.length === 0 ? e : { ...e, context: [...(e.context ?? []), ...taken] })
  })
}
