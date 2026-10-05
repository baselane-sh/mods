import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { answerCommand, NO_TOOLS } from '../engine'
import type { CommandRule, CommandTools } from '../engine'
import { EMPTY } from '../tracker'

// The session record the engine keeps; the build swaps in the mod's name.
const record = atom({ plugin: 'receipt', key: 'record' } as const, EMPTY)

// The commands whose rules read only the session record.
export const answerCommands = (on: On, rules: readonly CommandRule[]): void => {
  for (const rule of rules) {
    on('command.run', { command: rule.name }, async ($, event) => {
      const tools: CommandTools = NO_TOOLS
      return answerCommand(rule, event.args ?? '', tools, {
        usage: () => $.session.usage(),
        turns: () => $.session.turns(),
        now: () => $.clock.now(),
        kept: () => read($, record),
        copy: text => $.ui.copy({ text }),
      })
    })
  }
}
