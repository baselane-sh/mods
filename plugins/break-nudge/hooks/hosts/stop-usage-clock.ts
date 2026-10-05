import type { On, PluginOptions } from 'claude-code'

import { NO_TOOLS, remindAll } from '../engine'
import type { Nudge, NudgeTools } from '../engine'

// The turn's end for nudges that read the session's usage and the clock.
export const remindWithUsageAndClock = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = {
      ...NO_TOOLS,
      contextPercent: async () => (await $.session.usage()).context.percent,
      sessionStartedAt: async () => (await $.session.usage()).startedAt,
      now: () => $.clock.now(),
    }
    await remindAll(nudges, tools, options, text => $.ui.toast(text), text => $.ui.log(text))
    return next(e)
  })
}
