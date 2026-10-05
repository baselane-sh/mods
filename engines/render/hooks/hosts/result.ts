import type { On } from 'claude-code'

import { drawToolResult, NO_READS } from '../engine'
import type { RenderRule } from '../engine'

// Tool results for rules that draw from the result alone.
export const drawToolResults = (on: On, rules: readonly RenderRule[]): void => {
  for (const { id, toolResult } of rules) {
    if (toolResult === undefined) continue
    on('ui.render', { component: 'ToolResult' }, async ($, e, next) =>
      drawToolResult(id, toolResult, e, next, {
        ...NO_READS,
        elements: () => $.ui.resolve(e),
        log: text => $.ui.log(text),
      }),
    )
  }
}
