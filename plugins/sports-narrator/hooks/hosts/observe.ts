import type { On } from 'claude-code'

import { observeAll } from '../engine'
import type { Nudge } from '../engine'

// For nudges with `observe`: each tool call, once the tool answered.
export const observeCalls = (on: On, nudges: readonly Nudge[]): void => {
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const cwd = await $.session.cwd().catch(() => '')
    await observeAll(nudges, e, ran, cwd, text => $.ui.log(text))
    return ran
  })
}
