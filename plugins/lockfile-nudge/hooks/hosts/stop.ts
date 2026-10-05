import type { On, PluginOptions } from 'claude-code'

import { NO_TOOLS, remindAll } from '../engine'
import type { Nudge } from '../engine'

// The turn's end for nudges that read nothing but what they watched.
export const remindAtStop = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools = NO_TOOLS
    await remindAll(nudges, tools, options, text => $.ui.toast(text), text => $.ui.log(text))
    return next(e)
  })
}
