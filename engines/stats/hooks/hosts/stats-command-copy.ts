import type { On } from 'claude-code'

import { answerStatsCommand } from '../engine'
import type { StatsRule } from '../rule'

// The commands whose answer is also copied to the clipboard.
export const answerStatsCommandsWithCopy = (on: On, rules: readonly StatsRule[]): void => {
  for (const rule of rules) {
    const command = rule.command
    if (command === undefined) continue
    on('command.run', { command: command.name }, async ($, e) =>
      answerStatsCommand(command, e.args, {
        now: () => $.clock.now(),
        store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
        log: text => $.ui.log(text),
        copy: text => $.ui.copy({ text }),
      }),
    )
  }
}
