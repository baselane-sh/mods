import { atom, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { GitState, Outcome, Pomodoro, Tally } from '../types'
import { ARGV, READ_TIMEOUT_MS, TOUCHING_TOOLS, refreshGit } from './git'
import type { BandRule } from './rule'
import { addCall } from './tally'

const WINDOW = 20

// The same atoms as engine.tsx: the state scan wants each spelled in the
// file that reads or writes it. The build writes the mod's own name for the token.
const outcomes = atom({ plugin: 'dev-band', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'dev-band', key: 'pomodoro' } as const, null as Pomodoro | null)
const tally = atom({ plugin: 'dev-band', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'dev-band', key: 'git' } as const, null as GitState | null)

const failed = (where: string, error: unknown): string =>
  `band: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

// Watches each tool call for the rules that draw from how it ended: the recent
// outcomes, the tally of the session, the repository. The result is passed on
// as it came: a denied call stays denied. Only one hook may answer `tool.call`
// without a matcher, so the three share it.
export const watchCalls = (on: On, rules: readonly BandRule[]): void => {
  const has = (flag: 'tracksOutcomes' | 'tracksTools' | 'tracksGit'): boolean => rules.some(rule => rule[flag] === true)
  const [isOutcomes, isTally, isGit] = [has('tracksOutcomes'), has('tracksTools'), has('tracksGit')]
  if (!isOutcomes && !isTally && !isGit) return

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const outcome: Outcome = ran.deny !== undefined ? 'block' : ran.isError === true ? 'error' : 'ok'
      if (isOutcomes) await update($, outcomes, recent => [...recent, outcome].slice(-WINDOW))
      if (isTally) await update($, tally, current => addCall(current, e.tool, outcome !== 'ok'))
    } catch (error) {
      await $.ui.log(failed('outcomes', error))
    }
    // A denied call changed nothing.
    if (isGit && ran.deny === undefined && TOUCHING_TOOLS.has(e.tool)) {
      await refreshGit({
        run: () => $.process.run(ARGV, { timeoutMs: READ_TIMEOUT_MS }),
        set: state => update($, git, () => state),
        log: text => $.ui.log(text),
      })
    }
    return ran
  })
}

// The running intervals, by command name. A handle is not drawn state, so it
// is a module variable. A hot reload cancels the interval and keeps the state:
// the timer then freezes until its command stops it.
const running = new Map<string, Timer>()

// Registers each timer rule's command and runs its interval. The command
// starts the timer when none runs and stops it when one does.
export const watchTickers = (on: On, rules: readonly BandRule[]): void => {
  const tickers = rules.flatMap(rule => (rule.ticker === undefined ? [] : [rule.ticker]))
  if (tickers.length === 0) return

  on('session.start', async ($, e, next) => {
    for (const { command } of tickers) await $.command.register(command)
    return next(e)
  })

  for (const ticker of tickers) {
    const name = ticker.command.name
    on('command.run', { command: name }, async $ => {
      running.get(name)?.cancel()
      running.delete(name)

      const now = await $.clock.now()
      const { next, text } = ticker.toggle(await read($, pomodoro), now)
      await update($, pomodoro, () => next)
      if (next === null) return { text }

      // The callback closes over `$`; it never passes it on.
      running.set(
        name,
        $.clock.every(ticker.everyMs, async () => {
          try {
            const at = await $.clock.now()
            let toast: string | undefined
            // A stop that lands during a tick must stay stopped.
            await update($, pomodoro, current => {
              if (current === null) return null
              const ticked = ticker.tick(current, at)
              toast = ticked.toast
              return ticked.next
            })
            if (toast !== undefined) await $.ui.toast(toast)
          } catch (error) {
            await $.ui.log(failed(name, error))
          }
        }),
      )
      return { text }
    })
  }
}
