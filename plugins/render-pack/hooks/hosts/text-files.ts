import type { On } from 'claude-code'

import { drawAssistantText, NO_TEXT_READS, reason } from '../engine'
import type { RenderRule } from '../engine'

// Assistant text for rules that check files and put text into the prompt.
export const drawTextWithFiles = (on: On, rules: readonly RenderRule[]): void => {
  for (const { id, assistantText } of rules) {
    if (assistantText === undefined) continue
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) =>
      drawAssistantText(id, assistantText, e, next, {
        ...NO_TEXT_READS,
        elements: () => $.ui.resolve(e),
        cwd: () => $.session.cwd(),
        stat: path => $.fs.stat(path),
        insert: text =>
          void $.prompt
            .fill({ text, mode: 'insert' })
            .catch(error => $.ui.log(`${id}: the prompt did not take ${text.trim()}, ${reason(error)}`)),
        log: text => $.ui.log(text),
      }),
    )
  }
}
