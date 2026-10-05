import type { On } from 'claude-code'

import { promptNotesFor } from '../engine'
import type { GuardRule } from '../engine'

// For rules with `prompt`: a note the model reads beside the person's prompt.
export const notePrompts = (on: On, rules: readonly GuardRule[]): void => {
  on('prompt.submit', (_$, e, next) => {
    const notes = promptNotesFor(rules, e.text)
    return next(notes.length === 0 ? e : { ...e, context: [...(e.context ?? []), ...notes] })
  })
}
