import type { On } from 'claude-code'

import { reason } from '../engine'
import type { RenderRule } from '../engine'

// How long each call ran, by tool_use_id. The build writes the mod's name
// over the plugin token: only the owning plugin may write the value.
const DURATIONS = { plugin: 'time-badge', key: 'durations' } as const

// For a `timed` rule. The settings hooks' PostToolUse events carry the tool's
// run time without the permission prompt and hook time. One pair of hooks
// serves every rule.
export const keepDurations = (on: On, _rules: readonly RenderRule[]): void => {
  on('classic.PostToolUse', async ($, e, next) => {
    if (e.duration_ms !== undefined) {
      await $.state.set({ ...DURATIONS, id: e.tool_use_id }, e.duration_ms).catch(error => $.ui.log(`render: no duration kept, ${reason(error)}`))
    }
    return next(e)
  })
  on('classic.PostToolUseFailure', async ($, e, next) => {
    if (e.duration_ms !== undefined) {
      await $.state.set({ ...DURATIONS, id: e.tool_use_id }, e.duration_ms).catch(error => $.ui.log(`render: no duration kept, ${reason(error)}`))
    }
    return next(e)
  })
}
