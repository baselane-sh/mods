import { atom, read, update } from 'claude-code'
import type { On, Timer } from 'claude-code'

import type { Fetched, GitState, Outcome, Pomodoro, Reading, Tally } from '../types'
import { runFetchers, storeFetched } from './fetch'
import { ARGV, READ_TIMEOUT_MS, TOUCHING_TOOLS, refreshGit } from './git'
import type { BandRule, Ticker } from './rule'
import { addCall } from './tally'

const WINDOW = 20

// The same atoms as engine.tsx: the state scan wants each spelled in the
// file that reads or writes it. The build writes the mod's own name for the token.
const outcomes = atom({ plugin: 'battery-band', key: 'outcomes' } as const, [] as readonly Outcome[])
const pomodoro = atom({ plugin: 'battery-band', key: 'pomodoro' } as const, null as Pomodoro | null)
const tally = atom({ plugin: 'battery-band', key: 'tally' } as const, { calls: {}, failures: 0 } as Tally)
const git = atom({ plugin: 'battery-band', key: 'git' } as const, null as GitState | null)
const fetched = atom({ plugin: 'battery-band', key: 'fetched' } as const, {} as Readonly<Record<string, Fetched | null>>)

const failed = (where: string, error: unknown): string =>
  `band: ${where} skipped, ${error instanceof Error ? error.message : String(error)}`

// Counts the git reads started, so only the newest one writes: a slow read
// that started first never lands over a newer one. Not drawn state.
let gitReads = 0

// Watches each tool call for the rules that draw from how it ended: the recent
// outcomes, the tally of the session, the repository. The result is passed on
// as it came: a denied call stays denied. Only one hook may answer `tool.call`
// without a matcher, so the three share it.
export const watchCalls = (on: On, rules: readonly BandRule[]): void => {
  const has = (flag: 'tracksOutcomes' | 'tracksTools' | 'tracksGit'): boolean => rules.some(rule => rule[flag] === true)
  const [isOutcomes, isTally, isGit] = [has('tracksOutcomes'), has('tracksTools'), has('tracksGit')]
  const isFetch = rules.some(rule => rule.fetch?.onEdit === true)
  if (!isOutcomes && !isTally && !isGit && !isFetch) return

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    try {
      const outcome: Outcome = ran.deny !== undefined ? 'block' : ran.isError === true ? 'error' : 'ok'
      if (isOutcomes) await update($, outcomes, recent => [...recent, outcome].slice(-WINDOW))
      if (isTally) await update($, tally, current => addCall(current, e.tool, outcome !== 'ok'))
    } catch (error) {
      await $.ui.log(failed('outcomes', error))
    }
    // A denied call changed nothing. Not awaited: the tool's result does not
    // wait on git, and refreshGit logs its own failures.
    if (isGit && ran.deny === undefined && TOUCHING_TOOLS.has(e.tool)) {
      gitReads += 1
      const id = gitReads
      void refreshGit({
        run: () => $.process.run(ARGV, { timeoutMs: READ_TIMEOUT_MS }),
        set: state => (id === gitReads ? update($, git, () => state) : undefined),
        log: text => $.ui.log(text),
      })
    }
    // A rule that reads a command's output asks again after the same calls,
    // also not awaited.
    if (isFetch && ran.deny === undefined && TOUCHING_TOOLS.has(e.tool)) {
      void runFetchers(rules, 'edit', {
        now: () => $.clock.now(),
        run: (argv, timeoutMs) => $.process.run(argv, { timeoutMs }),
        git: () => read($, git),
        set: (id, value) => storeFetched(change => update($, fetched, change), id, value),
        log: text => $.ui.log(text),
      })
    }
    return ran
  })
}

const MINUTE_MS = 60_000

// The minute tick, a handle like `running` below. A hot reload cancels it and
// the next turn end starts it again.
let minuteTick: Timer | undefined

// The clock as closures over `$.clock`, and `tick`, which redraws the band.
export type MinuteDeps = {
  now: () => Promise<number>
  after: (ms: number, fn: () => void) => Timer
  every: (ms: number, fn: () => void) => Timer
  tick: () => Promise<void>
}

export const stopMinuteTick = (): void => {
  minuteTick?.cancel()
  minuteTick = undefined
}

// Ticks on each minute while some rule wants it for `reading`, and stops once
// none does. The first tick waits for the next whole minute, so a clock drawn
// as HH:MM turns over when the minute does.
export const syncMinuteTick = async (rules: readonly BandRule[], reading: Reading, deps: MinuteDeps): Promise<void> => {
  // A rule that fetches on a rate needs the tick to come back to it.
  const isWanted = (rule: BandRule): boolean => rule.everyMinute?.(reading) === true || rule.fetch?.everyMs !== undefined
  if (!rules.some(isWanted)) return stopMinuteTick()
  const now = await deps.now()
  if (minuteTick !== undefined) return
  let every: Timer | undefined
  const first = deps.after(MINUTE_MS - (now % MINUTE_MS), () => {
    void deps.tick()
    every = deps.every(MINUTE_MS, () => void deps.tick())
  })
  minuteTick = {
    cancel: () => {
      first.cancel()
      every?.cancel()
    },
  }
}

// The running intervals, by command name. A handle is not drawn state, so it
// is a module variable. A hot reload cancels the interval and keeps the state:
// the timer then freezes until its command stops it.
const running = new Map<string, Timer>()

export const tickersOf = (rules: readonly BandRule[]): Ticker[] =>
  rules.flatMap(rule => (rule.ticker === undefined ? [] : [rule.ticker]))

// Registers each timer rule's command handler and runs its interval. The command
// starts the timer when none runs and stops it when one does. The engine's
// session.start hook registers the command names (`on("session.start")` takes
// one hook), from `tickersOf`.
export const watchTickers = (on: On, rules: readonly BandRule[]): void => {
  const tickers = tickersOf(rules)
  if (tickers.length === 0) return

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
