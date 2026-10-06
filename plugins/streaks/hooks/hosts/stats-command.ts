import type { On } from 'claude-code'

import { answerStatsCommand } from '../engine'
import type { StatsRule } from '../rule'

// The commands that only print. This host has no clipboard call, so a mod
// whose rules never copy does not list one.
export const answerStatsCommands = (on: On, rules: readonly StatsRule[]): void => {
  for (const rule of rules) {
    const command = rule.command
    if (command === undefined) continue
    on('command.run', { command: command.name }, async ($, e) =>
      answerStatsCommand(command, e.args, {
        now: () => $.clock.now(),
        store: { get: key => $.store.get(key), set: (key, value) => $.store.set(key, value) },
        log: text => $.ui.log(text),
      }),
    )
  }
}
