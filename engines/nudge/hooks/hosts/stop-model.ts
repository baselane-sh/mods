import type { ModelCompleteRequest, On, PluginOptions } from 'claude-code'

import { NO_TOOLS, remindAll } from '../engine'
import type { Nudge, NudgeTools } from '../engine'

// The turn's end for nudges that make a model call (it spends tokens).
export const remindWithModel = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = { ...NO_TOOLS, complete: (request: ModelCompleteRequest) => $.model.complete(request) }
    await remindAll(nudges, tools, options, text => $.ui.toast(text), text => $.ui.log(text))
    return next(e)
  })
}
