import type { On } from 'claude-code'

import { drawToolRow, NO_ROW_READS } from '../engine'
import type { RenderRule } from '../engine'

// Tool rows for rules that draw from the row alone.
export const drawToolRows = (on: On, rules: readonly RenderRule[]): void => {
  for (const { id, toolRow } of rules) {
    if (toolRow === undefined) continue
    on('ui.render', { component: 'ToolUse' }, async ($, e, next) =>
      drawToolRow(id, toolRow, e, next, {
        ...NO_ROW_READS,
        elements: () => $.ui.resolve(e),
        log: text => $.ui.log(text),
      }),
    )
  }
}
