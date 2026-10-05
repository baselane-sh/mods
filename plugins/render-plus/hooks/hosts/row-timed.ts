import type { On } from 'claude-code'

import { drawToolRow, NO_ROW_READS } from '../engine'
import type { RenderRule } from '../engine'

// Written by hosts/timer.ts, which spells the same value.
const DURATIONS = { plugin: 'render-plus', key: 'durations' } as const

// Tool rows for a `timed` rule: it reads how long the call ran.
export const drawToolRowsWithDurations = (on: On, rules: readonly RenderRule[]): void => {
  for (const { id, toolRow } of rules) {
    if (toolRow === undefined) continue
    on('ui.render', { component: 'ToolUse' }, async ($, e, next) =>
      drawToolRow(id, toolRow, e, next, {
        ...NO_ROW_READS,
        duration: async () => (await $.state.get({ ...DURATIONS, id: e.props.tool_use_id })).value,
        elements: () => $.ui.resolve(e),
        log: text => $.ui.log(text),
      }),
    )
  }
}
