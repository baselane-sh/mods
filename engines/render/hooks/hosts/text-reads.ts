import type { On } from 'claude-code'

import { drawAssistantText, NO_TEXT_READS } from '../engine'
import type { RenderRule } from '../engine'

// Assistant text for rules that read the session's directory and git repository.
export const drawTextWithRepo = (on: On, rules: readonly RenderRule[]): void => {
  for (const { id, assistantText } of rules) {
    if (assistantText === undefined) continue
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) =>
      drawAssistantText(id, assistantText, e, next, {
        ...NO_TEXT_READS,
        elements: () => $.ui.resolve(e),
        cwd: () => $.session.cwd(),
        repo: () => $.session.repo(),
        log: text => $.ui.log(text),
      }),
    )
  }
}
