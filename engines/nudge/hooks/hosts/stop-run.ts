import type { On, PluginOptions } from 'claude-code'

import { NO_TOOLS, RUN_TIMEOUT_MS, remindAll } from '../engine'
import type { Nudge, NudgeTools } from '../engine'

// The turn's end for nudges that run a program (bd, for the beads nudges).
export const remindWithRun = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = {
      ...NO_TOOLS,
      run: (argv, cwd) => $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS }),
    }
    await remindAll(nudges, tools, options, text => $.ui.toast(text), text => $.ui.log(text))
    return next(e)
  })
}
