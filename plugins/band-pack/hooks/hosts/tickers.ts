import { atom, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { Pomodoro } from '../../types'
import { failed, tickersOf } from '../engine'
import type { BandRule } from '../rule'

// The same atom as engine.tsx: the state scan wants it spelled in the file
// that reads or writes it. The build writes the mod's own name for the token.
const pomodoro = atom({ plugin: 'band-pack', key: 'pomodoro' } as const, null as Pomodoro | null)

// The running intervals, by command name. A handle is not drawn state, so it
// is a module variable. A hot reload cancels the interval and keeps the state:
// the timer then freezes until its command stops it.
const running = new Map<string, Timer>()

// For a rule with a ticker: registers its command handler and runs its
// interval. The command starts the timer when none runs and stops it when one
// does. The start host registers the command names (`on("session.start")`
// takes one hook), from `tickersOf`.
export const watchTickers = (on: On, rules: readonly BandRule[]): void => {
  const tickers = tickersOf(rules)

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
