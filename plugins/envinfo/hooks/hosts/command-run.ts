import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { answerCommand, exec, NO_TOOLS } from '../engine'
import type { CommandRule, CommandTools } from '../engine'
import { EMPTY } from '../tracker'

// The session record the engine keeps; the build swaps in the mod's name.
const record = atom({ plugin: 'envinfo', key: 'record' } as const, EMPTY)

// Where a program runs: a folder that holds no project file. A toolchain
// manager (rustup, go, mise) reads the project's version file from the working
// directory and can download a toolchain to answer `--version`.
const NEUTRAL_DIR = '/'

// The commands whose rules run a program (to read its version).
export const answerCommandsWithRun = (on: On, rules: readonly CommandRule[]): void => {
  for (const rule of rules) {
    on('command.run', { command: rule.name }, async ($, event) => {
      const tools: CommandTools = {
        ...NO_TOOLS,
        run: (argv, timeoutMs) => exec(() => $.process.run(argv, { cwd: NEUTRAL_DIR, timeoutMs }), timeoutMs, () => $.clock.now()),
      }
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
