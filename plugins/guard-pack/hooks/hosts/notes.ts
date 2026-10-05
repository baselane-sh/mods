import type { On } from 'claude-code'

import { notesFor } from '../engine'
import type { GuardRule } from '../engine'

// For rules with `after`: a note the model reads with the tool's result.
export const noteResults = (on: On, rules: readonly GuardRule[]): void => {
  on('tool.call', async (_$, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    const notes = notesFor(rules, e, ran)
    return notes.length === 0 ? ran : { ...ran, context: [...(ran.context ?? []), ...notes] }
  })
}
