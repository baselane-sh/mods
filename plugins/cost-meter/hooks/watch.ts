import { atom, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { Outcome, Pomodoro } from '../types'
import type { BandRule } from './rule'

const WINDOW = 20

// The same two atoms as engine.tsx: the state scan wants each spelled in the
// file that reads or writes it. The build writes the mod's own name for the token.
const outcomes = atom({ plugin: 'cost-meter', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'cost-meter', key: 'pomodoro' } as const, null as Pomodoro | null)

const failed = (where: string, error: unknown): string =>
  `band: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

// Records how each tool call ended, for the rules that draw from it. The
// result is passed on as it came: a denied call stays denied.
export const watchOutcomes = (on: On, rules: readonly BandRule[]): void => {
  if (!rules.some(rule => rule.tracksOutcomes === true)) return
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const outcome: Outcome = ran.deny !== undefined ? 'block' : ran.isError === true ? 'error' : 'ok'
      await update($, outcomes, recent => [...recent, outcome].slice(-WINDOW))
    } catch (error) {
      await $.ui.log(failed('outcomes', error))
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
