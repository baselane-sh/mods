import { atom, read } from 'claude-code'
import type { On } from 'claude-code'

import { answerCommand, exec, GIT_TIMEOUT_MS, NO_TOOLS } from '../engine'
import type { CommandRule, CommandTools } from '../engine'
import { EMPTY } from '../tracker'

// The session record the engine keeps; the build swaps in the mod's name.
const record = atom({ plugin: 'audit-pack', key: 'record' } as const, EMPTY)

// The commands whose rules read the repo with git, also keeping its exit code (a search with no match).
export const answerCommandsWithGitRun = (on: On, rules: readonly CommandRule[]): void => {
  for (const rule of rules) {
    on('command.run', { command: rule.name }, async ($, event) => {
      const tools: CommandTools = {
        ...NO_TOOLS,
        cwd: () => $.session.cwd(),
        git: async (...args) => {
          const dir = await $.session.cwd()
          const ran = await $.process.run(['git', '-C', dir, ...args], { cwd: dir, timeoutMs: GIT_TIMEOUT_MS })
          if (ran.isStdoutTruncated) throw new Error(`git ${args[0]} output passed the 4 MiB cap`)
          return ran.exitCode === 0 ? ran.stdout : undefined
        },
        gitRun: async (...args) => {
          const dir = await $.session.cwd()
          return exec(() => $.process.run(['git', '-C', dir, ...args], { cwd: dir, timeoutMs: GIT_TIMEOUT_MS }), GIT_TIMEOUT_MS, () => $.clock.now())
        },
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
