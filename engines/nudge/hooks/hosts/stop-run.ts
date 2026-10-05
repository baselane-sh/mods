import type { On } from 'claude-code'

import { NO_TOOLS, RUN_TIMEOUT_MS, remindAll } from '../engine'
import type { Nudge, NudgeTools, PendingNotes } from '../engine'

// The turn's end for nudges that run a program (bd, for the beads nudges).
// Each reminder is shown as a toast and kept as a note for the next prompt.
export const remindWithRun = (on: On, nudges: readonly Nudge[], notes: PendingNotes): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = {
      ...NO_TOOLS,
      run: (argv, cwd) => $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS }),
    }
    const reminders = await remindAll(nudges, tools, {}, text => $.ui.toast(text), text => $.ui.log(text))
    for (const reminder of reminders) notes.add(reminder)
    return next(e)
  })
}
