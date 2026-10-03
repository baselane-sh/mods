import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { CommandRecord } from '../types'
import { draw } from './render'
import { EMPTY, observe } from './tracker'

// What the engine knows about the session beside the record. A figure the
// host does not have is left out, never zeroed, so a rule can say "n/a".
export type Facts = {
  turns?: number
  elapsedMs?: number
  contextPercent?: number
  costUsd?: number
}

// What a rule may reach beyond the record, as closures over the host calls
// (a rule never holds `$`). A rule that needs none of it ignores the argument.
export type CommandTools = {
  // The session's working directory.
  cwd: () => Promise<string>
  // `git -C <cwd> <args>`: stdout, or undefined when git exits non-zero (which
  // is also what a directory outside any repo answers). Output past the host's
  // 4 MiB cap, or a git that times out, throws.
  git: (...args: string[]) => Promise<string | undefined>
  exists: (path: string) => Promise<boolean>
  // Creates the file and its directories.
  write: (path: string, text: string) => Promise<void>
}

// What a rule answers: text to print and copy, or `{ text, copy: false }` for
// a message that is not a result (an error must not replace the clipboard).
export type Composed = string | { text: string; copy: false }

// One slash command: its name and description, and how it turns the session
// record into the text it prints. Pure unless it uses `tools`.
export type CommandRule = {
  name: string
  description: string
  compose: (record: CommandRecord, facts: Facts, tools: CommandTools) => Composed | Promise<Composed>
}

const GIT_TIMEOUT_MS = 15_000

// A state value is written only by the plugin that owns it, and the owner is
// the mod's name. The host wants the owner as a literal, so this source writes
// the first mod's name and scripts/build.mjs swaps in each mod's own name
// (engine.json, stateOwner). The same swap runs in types/index.d.ts.
const record = atom({ plugin: 'receipt', key: 'record' } as const, EMPTY)

const attempt = async <T>(read: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await read()
  } catch {
    return undefined
  }
}

export const registerCommands = (on: On, rules: readonly CommandRule[]): void => {
  // The one tracker every rule reads. It lives in `$.state`, so a hot reload
  // of the mod keeps the session so far.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      await update($, record, so_far => observe(so_far, e, ran))
    } catch (error) {
      await $.ui.log(`command: could not record ${e.tool}, ${error instanceof Error ? error.message : String(error)}`)
    }
    return ran
  })

  // /clear ends the conversation without a new session.start: start over.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, record, () => EMPTY)
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    for (const rule of rules) await $.command.register({ name: rule.name, description: rule.description })
    return next(e)
  })

  for (const rule of rules) {
    on('command.run', { command: rule.name }, async $ => {
      const usage = await attempt(() => $.session.usage())
      const turns = await attempt(() => $.session.turns())
      const now = await attempt(() => $.clock.now())
      const kept = await attempt(() => read($, record))

      const facts: Facts = {
        ...(turns === undefined ? {} : { turns }),
        ...(usage === undefined || now === undefined ? {} : { elapsedMs: Math.max(0, now - usage.startedAt) }),
        ...(usage?.context.percent === undefined ? {} : { contextPercent: usage.context.percent }),
        ...(usage?.cost === undefined ? {} : { costUsd: usage.cost.usd }),
      }

      const tools: CommandTools = {
        cwd: () => $.session.cwd(),
        git: async (...args) => {
          const dir = await $.session.cwd()
          const ran = await $.process.run(['git', '-C', dir, ...args], { cwd: dir, timeoutMs: GIT_TIMEOUT_MS })
          if (ran.isStdoutTruncated) throw new Error(`git ${args[0]} output passed the 4 MiB cap`)
          return ran.exitCode === 0 ? ran.stdout : undefined
        },
        exists: path => $.fs.exists(path),
        write: (path, text) => $.fs.write(path, text),
      }

      let composed: Composed
      try {
        composed = await rule.compose(kept ?? EMPTY, facts, tools)
      } catch (error) {
        return { text: `${rule.name}: failed, ${error instanceof Error ? error.message : String(error)}` }
      }

      if (typeof composed !== 'string') return { text: composed.text }
      const text = composed

      const copy = await attempt(() => $.ui.copy({ text }))
      const note =
        copy === undefined ? 'not copied (clipboard error)' : copy.isCopied ? 'copied to clipboard' : `not copied (${copy.reason})`
      return { text: `${text}\n\n${note}` }
    })

    // A surface without Box or Text keeps the plain output row.
    on('ui.render', { component: 'CommandOutput', props: { command: rule.name } }, ($, e, next) => {
      const { Box, Text } = $.ui.resolve(e)
      return Box === undefined || Text === undefined ? next(e) : draw({ Box, Text }, e.props.text)
    })
  }
}
