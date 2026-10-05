import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { answerCommand, exec, NO_TOOLS } from '../engine'
import type { CommandRule, CommandTools } from '../engine'
import { EMPTY } from '../tracker'

// The session record the engine keeps; the build swaps in the mod's name.
const record = atom({ plugin: 'receipt', key: 'record' } as const, EMPTY)

// The commands whose rules run bd (the beads issue tracker) in the session's
// folder. They print only: this host has no clipboard call.
export const answerCommandsWithBd = (on: On, rules: readonly CommandRule[]): void => {
  for (const rule of rules) {
    on('command.run', { command: rule.name }, async ($, event) => {
      const tools: CommandTools = {
        ...NO_TOOLS,
        run: (argv, timeoutMs) =>
          exec(async () => $.process.run(argv, { cwd: await $.session.cwd(), timeoutMs }), timeoutMs, () => $.clock.now()),
      }
      return answerCommand(rule, event.args ?? '', tools, {
        usage: () => $.session.usage(),
        turns: () => $.session.turns(),
        now: () => $.clock.now(),
        kept: () => read($, record),
      })
    })
  }
}
