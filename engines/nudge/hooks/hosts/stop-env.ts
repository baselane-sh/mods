import type { On, PluginOptions } from 'claude-code'

import { ENV_EXAMPLE, envNames, NO_TOOLS, remindAll } from '../engine'
import type { Nudge, NudgeTools } from '../engine'

// The turn's end for nudges that read the variable names in .env.example.
export const remindWithEnvNames = (on: On, nudges: readonly Nudge[], options: PluginOptions = {}): void => {
  on('classic.Stop', async ($, e, next) => {
    const tools: NudgeTools = {
      ...NO_TOOLS,
      envExampleNames: async () => ((await $.fs.exists(ENV_EXAMPLE)) ? envNames(await $.fs.read(ENV_EXAMPLE)) : undefined),
    }
    await remindAll(nudges, tools, options, text => $.ui.toast(text), text => $.ui.log(text))
    return next(e)
  })
}
